#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const vendorDir = path.join(repoRoot, 'vendor', 'life-state-v5.35');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function verifyLifeStateVendor({ sourceJson, sourceRegex } = {}) {
  const provenancePath = path.join(vendorDir, 'PROVENANCE.json');
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  const jsonBytes = fs.readFileSync(path.join(vendorDir, provenance.vendored.json.fileName));
  const regexBytes = fs.readFileSync(path.join(vendorDir, provenance.vendored.regex.fileName));
  const jsBytes = fs.readFileSync(path.join(vendorDir, provenance.vendored.extractedJs.fileName));

  assert(jsonBytes.byteLength === provenance.vendored.json.byteLength, 'vendored JSON byte length changed');
  assert(regexBytes.byteLength === provenance.vendored.regex.byteLength, 'vendored regex byte length changed');
  assert(jsBytes.byteLength === provenance.vendored.extractedJs.byteLength, 'extracted JS byte length changed');
  assert(sha256(jsonBytes) === provenance.vendored.json.sha256, 'vendored JSON SHA-256 mismatch');
  assert(sha256(regexBytes) === provenance.vendored.regex.sha256, 'vendored regex SHA-256 mismatch');
  assert(sha256(jsBytes) === provenance.vendored.extractedJs.sha256, 'extracted JS SHA-256 mismatch');

  const parsed = JSON.parse(jsonBytes.toString('utf8'));
  assert(typeof parsed.content === 'string', 'vendored JSON content is not a string');
  const expectedJsBytes = Buffer.from(parsed.content, 'utf8');
  assert(expectedJsBytes.equals(jsBytes), 'extracted JS is not byte-for-byte UTF-8 encoding of JSON.content');
  assert(parsed.content.length === provenance.vendored.extractedJs.characterLength, 'extracted JS character length mismatch');

  const parsedRegex = JSON.parse(regexBytes.toString('utf8'));
  assert(parsedRegex && typeof parsedRegex === 'object', 'vendored regex JSON is invalid');

  if (sourceJson) {
    const original = fs.readFileSync(sourceJson);
    assert(original.equals(jsonBytes), 'vendored JSON differs byte-for-byte from supplied source');
    assert(sha256(original) === provenance.source.json.sha256, 'supplied source JSON SHA-256 mismatch');
  }
  if (sourceRegex) {
    const original = fs.readFileSync(sourceRegex);
    assert(original.equals(regexBytes), 'vendored regex differs byte-for-byte from supplied source');
    assert(sha256(original) === provenance.source.regex.sha256, 'supplied source regex SHA-256 mismatch');
  }

  return provenance;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const provenance = verifyLifeStateVendor({
    sourceJson: process.argv[2] ? path.resolve(process.argv[2]) : undefined,
    sourceRegex: process.argv[3] ? path.resolve(process.argv[3]) : undefined,
  });
  console.log('life-state-v5.35 vendor verification: PASS');
  console.log(`JSON ${provenance.vendored.json.sha256}`);
  console.log(`regex ${provenance.vendored.regex.sha256}`);
  console.log(`JS ${provenance.vendored.extractedJs.sha256}`);
}
