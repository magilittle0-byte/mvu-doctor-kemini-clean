import { loadModuleLock } from '../modular/lock.mjs';

const P1_VERSION = '0.10.26';
const P1_FINGERPRINT = 'c7a8af5a7f33363f06796e1b0f587ec087387dfe3cf4ac2281266145c589d595';
const P2_VERSION = '0.1.0-candidate.2';
const P2_FINGERPRINT = 'fc2e81eb7e8402e3eb2bf6a4f0b24be0a654e147cbb2da4581548d1d5ef027be';
const P2_LOCK_SHA256 = '61239fb877271ab113e45e9b18f85bd101d29ac94dec9daa1b28c4b636a47364';
const HASH = /^[0-9a-f]{64}$/u;
const P1_DEPENDENCY_PATHS = ['locks/phase1.json', 'locks/phase1-evidence.json', 'locks/phase1-supporting-files.json'];
const KNOWN_FAILURES = new Set(['unsafe_dependency_path', 'dependency_missing', 'dependency_read_failed', 'crypto_unavailable', 'text_decoder_unavailable', 'text_encoder_unavailable', 'p2_lock_malformed', 'p1_supporting_malformed']);

function safeRelativePath(file) {
  return typeof file === 'string'
    && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u.test(file)
    && !file.split('/').some(part => part === '.' || part === '..');
}

function validMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length > 0
    && Object.entries(value).every(([file, hash]) => safeRelativePath(file) && HASH.test(hash));
}

function exactKeys(value, expected) {
  const keys = Object.keys(value || {}).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(cryptoImpl, bytes) {
  const subtle = cryptoImpl?.subtle || cryptoImpl?.webcrypto?.subtle;
  if (!subtle) throw new Error('crypto_unavailable');
  return hex(await subtle.digest('SHA-256', bytes));
}

function decoder() {
  if (typeof TextDecoder !== 'function') throw new Error('text_decoder_unavailable');
  return new TextDecoder();
}

function encoder() {
  if (typeof TextEncoder !== 'function') throw new Error('text_encoder_unavailable');
  return new TextEncoder();
}

function parseJson(bytes, reason) {
  try { return JSON.parse(decoder().decode(bytes)); }
  catch { throw new Error(reason); }
}

export async function loadWorldDependencies(root, { fetch: fetchImpl = globalThis.fetch, crypto: cryptoImpl = globalThis.crypto } = {}) {
  if (typeof fetchImpl !== 'function' || !root) return { locked: false, reason: 'dependency_reader_unavailable' };
  const base = String(root).endsWith('/') ? String(root) : `${String(root)}/`;
  const get = async relative => {
    if (!safeRelativePath(relative)) throw new Error('unsafe_dependency_path');
    const response = await fetchImpl(new URL(relative, base).href, { cache: 'no-store' });
    if (response.status === 404) throw new Error('dependency_missing');
    if (!response.ok) throw new Error('dependency_read_failed');
    return new Uint8Array(await response.arrayBuffer());
  };
  try {
    const p1 = await loadModuleLock(root, P1_VERSION, { fetch: fetchImpl, crypto: cryptoImpl });
    if (!p1?.locked || p1.fingerprint !== P1_FINGERPRINT) return { locked: false, reason: `p1_${p1?.reason || 'lock_invalid'}` };

    const p2LockBytes = await get('locks/phase2.json');
    if (await digest(cryptoImpl, p2LockBytes) !== P2_LOCK_SHA256) return { locked: false, reason: 'p2_lock_bytes_changed' };
    const p2 = parseJson(p2LockBytes, 'p2_lock_malformed');
    if (p2.locked !== true || p2.stage !== 2 || p2.version !== P2_VERSION || p2.fingerprint !== P2_FINGERPRINT) {
      return { locked: false, reason: 'p2_lock_identity_mismatch' };
    }
    if (!validMap(p2.files) || Object.keys(p2.files).length !== 10) {
      return { locked: false, reason: 'p2_runtime_map_invalid' };
    }
    if (!validMap(p2.supportingFiles) || Object.keys(p2.supportingFiles).length !== 8) {
      return { locked: false, reason: 'p2_supporting_map_invalid' };
    }
    if (!p2.p1Dependencies || !exactKeys(p2.p1Dependencies, P1_DEPENDENCY_PATHS)
      || !P1_DEPENDENCY_PATHS.every(file => HASH.test(p2.p1Dependencies[file]))) {
      return { locked: false, reason: 'p1_dependency_map_invalid' };
    }

    for (const file of [...Object.keys(p2.files), ...Object.keys(p2.supportingFiles)]) {
      const bytes = await get(file);
      const expected = p2.files[file] || p2.supportingFiles[file];
      if (await digest(cryptoImpl, bytes) !== expected) return { locked: false, reason: `p2_file_changed:${file}` };
    }
    const p1DependencyBytes = new Map();
    for (const file of P1_DEPENDENCY_PATHS) {
      const bytes = await get(file);
      if (await digest(cryptoImpl, bytes) !== p2.p1Dependencies[file]) return { locked: false, reason: `p1_dependency_changed:${file}` };
      p1DependencyBytes.set(file, bytes);
    }
    const p1SupportingBytes = p1DependencyBytes.get('locks/phase1-supporting-files.json');
    const p1Supporting = parseJson(p1SupportingBytes, 'p1_supporting_malformed');
    if (p1Supporting.stage !== 1 || !validMap(p1Supporting.files) || Object.keys(p1Supporting.files).length !== 11) {
      return { locked: false, reason: 'p1_supporting_map_invalid' };
    }
    for (const file of Object.keys(p1Supporting.files)) {
      const bytes = await get(file);
      if (await digest(cryptoImpl, bytes) !== p1Supporting.files[file]) return { locked: false, reason: `p1_supporting_changed:${file}` };
    }
    return { locked: true, p1, p2: { locked: true, stage: 2, version: p2.version, fingerprint: p2.fingerprint } };
  } catch (error) {
    const candidate = String(error?.message || '');
    const reason = KNOWN_FAILURES.has(candidate) ? candidate : 'dependency_validation_failed';
    return { locked: false, reason };
  }
}
