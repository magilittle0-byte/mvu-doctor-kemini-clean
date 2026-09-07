import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { loadModuleLock, readModuleLock, validateModuleLock } from '../modular/lock.mjs';

const hash = value => ({ aggregate: 'a', other: 'b', summary: 'c', a: 'd', b: 'e' }[value] || 'f').repeat(64);
const current = { version: '0.10.13', stage: 1, fingerprint: hash('aggregate'), files: { 'a.js': hash('a'), 'b.css': hash('b') } };
const evidence = { complete: true, rounds: 12, hardFailures: 0, sourceFingerprint: current.fingerprint, evidenceFingerprint: current.fingerprint, summarySha256: hash('summary') };
const record = { locked: true, stage: 1, version: current.version, fingerprint: current.fingerprint, files: { ...current.files }, realAcceptance: { ...evidence } };

test('missing lock is a normal unlocked candidate', () => {
  assert.deepEqual(validateModuleLock({ record: null, current, evidence }), { locked: false, reason: 'no_lock_record' });
});

test('valid record requires complete evidence and exact protected file set', () => {
  assert.equal(validateModuleLock({ record, current, evidence }).locked, true);
  assert.equal(validateModuleLock({ record: { ...record, files: { 'a.js': hash('a') } }, current, evidence }).reason, 'protected_files_changed');
  assert.equal(validateModuleLock({ record, current: { ...current, files: { ...current.files, 'c.js': hash('c') } }, evidence }).reason, 'protected_files_changed');
  assert.equal(validateModuleLock({ record, current, evidence: { ...evidence, rounds: 11 } }).reason, 'real_acceptance_evidence_mismatch');
  assert.equal(validateModuleLock({ record: { ...record, realAcceptance: { ...evidence, complete: false } }, current, evidence }).reason, 'real_acceptance_evidence_mismatch');
});

test('aggregate and evidence fingerprints are bound to the current candidate', () => {
  assert.equal(validateModuleLock({ record: { ...record, fingerprint: hash('other') }, current, evidence }).reason, 'aggregate_fingerprint_mismatch');
  assert.equal(validateModuleLock({ record, current, evidence: { ...evidence, sourceFingerprint: hash('other') } }).reason, 'real_acceptance_evidence_mismatch');
  assert.equal(validateModuleLock({ record, current, evidence: { ...evidence, summarySha256: hash('other') } }).reason, 'real_acceptance_evidence_mismatch');
  assert.equal(validateModuleLock({ record, current, evidence: { ...evidence, hardFailures: 1 } }).reason, 'real_acceptance_evidence_mismatch');
});

test('record reader returns null only for absent path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvu-lock-'));
  const missing = path.join(dir, 'missing.json');
  assert.equal(readModuleLock(missing, fs), null);
  const file = path.join(dir, 'lock.json');
  fs.writeFileSync(file, JSON.stringify(record));
  assert.deepEqual(readModuleLock(file, fs), record);
  fs.unlinkSync(file);
  fs.rmdirSync(dir);
});

test('browser reader hashes independent lock evidence and protected bytes', async () => {
  const bytes = new TextEncoder().encode('module bytes');
  const digest = value => webcrypto.subtle.digest('SHA-256', value).then(buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
  const fileHash = await digest(bytes);
  const files = { 'modular/a.js': fileHash };
  const aggregate = await digest(new TextEncoder().encode(JSON.stringify(files)));
  const evidenceBytes = new TextEncoder().encode(JSON.stringify({ sourceFingerprint: aggregate, complete: true, rounds: 12, hardFailures: 0 }));
  const evidenceHash = await digest(evidenceBytes);
  const lock = { locked: true, stage: 1, version: '0.10.13', fingerprint: aggregate, files, realAcceptance: { sourceFingerprint: aggregate, complete: true, rounds: 12, hardFailures: 0, evidenceFingerprint: aggregate, summarySha256: evidenceHash } };
  const responses = new Map([
    ['https://example.test/locks/phase1.json', new Response(JSON.stringify(lock))],
    ['https://example.test/locks/phase1-evidence.json', new Response(Buffer.from(evidenceBytes))],
    ['https://example.test/modular/a.js', new Response(bytes)],
  ]);
  const fetch = async url => responses.get(url)?.clone() || new Response('', { status: 404 });
  const result = await loadModuleLock('https://example.test/', '0.10.13', { fetch, crypto: webcrypto });
  assert.equal(result.locked, true);
  responses.set('https://example.test/modular/a.js', new Response('changed module bytes'));
  assert.equal((await loadModuleLock('https://example.test/', '0.10.13', { fetch, crypto: webcrypto })).locked, false);
  responses.set('https://example.test/modular/a.js', new Response(bytes));
  responses.set('https://example.test/locks/phase1-evidence.json', new Response(JSON.stringify({ sourceFingerprint: aggregate, complete: true, rounds: 11, hardFailures: 0 })));
  assert.equal((await loadModuleLock('https://example.test/', '0.10.13', { fetch, crypto: webcrypto })).locked, false);
  for (const file of ['https://other.test/a.js', '../outside.js', '/outside.js', 'a\\b.js', '%2e%2e/outside.js']) {
    const attempted = [];
    responses.set('https://example.test/locks/phase1.json', new Response(JSON.stringify({ ...lock, files: { [file]: fileHash } })));
    const result = await loadModuleLock('https://example.test/', '0.10.13', { fetch: async url => { attempted.push(url); return fetch(url); }, crypto: webcrypto });
    assert.equal(result.locked, false);
    assert.deepEqual(attempted, ['https://example.test/locks/phase1.json', 'https://example.test/locks/phase1-evidence.json']);
  }
});
