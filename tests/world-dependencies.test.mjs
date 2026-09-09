import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { loadWorldDependencies } from '../world/dependencies.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative));

function fixture() {
  const files = new Map();
  const add = relative => files.set(relative, read(relative));
  const p1 = JSON.parse(read('locks/phase1.json'));
  const p2 = JSON.parse(read('locks/phase2.json'));
  const p1Support = JSON.parse(read('locks/phase1-supporting-files.json'));
  add('locks/phase1.json'); add('locks/phase1-evidence.json'); add('locks/phase1-supporting-files.json'); add('locks/phase2.json');
  for (const file of Object.keys(p1.files)) add(file);
  for (const file of Object.keys(p2.files)) add(file);
  for (const file of Object.keys(p2.supportingFiles)) add(file);
  for (const file of Object.keys(p1Support.files)) add(file);
  return files;
}

function fetchFor(files) {
  return async url => {
    const key = new URL(url).pathname.replace(/^\//u, '');
    const bytes = files.get(key);
    if (!bytes) return { status: 404, ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    return { status: 200, ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
  };
}

test('loads approved P1 and P2 dependency maps from bytes', async () => {
  const result = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(fixture()), crypto: webcrypto });
  assert.equal(result.locked, true);
  assert.equal(result.p1.fingerprint, 'c7a8af5a7f33363f06796e1b0f587ec087387dfe3cf4ac2281266145c589d595');
  assert.equal(result.p2.fingerprint, '08ceb43d71877ea66693711c20a02ba87ccb49fa8851533bff69f708a786bb7d');
});

test('fails closed when a P2 runtime byte is changed or missing', async () => {
  const changed = fixture();
  changed.set('profiles/runtime.mjs', new TextEncoder().encode('changed'));
  const changedResult = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(changed), crypto: webcrypto });
  assert.equal(changedResult.locked, false);
  assert.match(changedResult.reason, /p2_file_changed|p1_|dependency_missing/u);
  const missing = fixture();
  missing.delete('profiles/runtime.mjs');
  const missingResult = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(missing), crypto: webcrypto });
  assert.equal(missingResult.locked, false);
});

test('fails closed for changed lock identity and unsafe lock path', async () => {
  const versionChanged = fixture();
  const lock = JSON.parse(versionChanged.get('locks/phase2.json').toString('utf8'));
  lock.version = '0.1.0-other';
  versionChanged.set('locks/phase2.json', new TextEncoder().encode(JSON.stringify(lock)));
  const versionResult = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(versionChanged), crypto: webcrypto });
  assert.equal(versionResult.locked, false);
  const unsafe = fixture();
  const unsafeLock = JSON.parse(unsafe.get('locks/phase2.json').toString('utf8'));
  unsafeLock.files['../outside.mjs'] = unsafeLock.files['profiles/runtime.mjs'];
  unsafe.delete('profiles/runtime.mjs');
  unsafe.set('locks/phase2.json', new TextEncoder().encode(JSON.stringify(unsafeLock)));
  const unsafeResult = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(unsafe), crypto: webcrypto });
  assert.equal(unsafeResult.locked, false);
  assert.equal(unsafeResult.reason, 'p2_lock_bytes_changed');
});

test('fails closed when a P1 supporting or P2 supporting byte is changed', async () => {
  const p1Changed = fixture();
  p1Changed.set('tests/module-lock.test.mjs', new TextEncoder().encode('changed-p1-support'));
  const p1Result = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(p1Changed), crypto: webcrypto });
  assert.equal(p1Result.locked, false);
  assert.equal(p1Result.reason, 'p1_supporting_changed:tests/module-lock.test.mjs');
  const p2Changed = fixture();
  p2Changed.set('docs/profiles/README.md', new TextEncoder().encode('changed-p2-support'));
  const p2Result = await loadWorldDependencies('https://fixture.test/', { fetch: fetchFor(p2Changed), crypto: webcrypto });
  assert.equal(p2Result.locked, false);
  assert.equal(p2Result.reason, 'p2_file_changed:docs/profiles/README.md');
});
