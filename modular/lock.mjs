const EVIDENCE_KEYS = ['complete', 'rounds', 'hardFailures', 'sourceFingerprint'];
const HASH = /^[0-9a-f]{64}$/u;

function sameKeys(left, right) {
  const a = Object.keys(left || {}).sort();
  const b = Object.keys(right || {}).sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function sameFiles(left, right) {
  return sameKeys(left, right) && Object.keys(right || {}).every(file => left[file] === right[file]);
}

function validFiles(files) {
  return files && typeof files === 'object' && !Array.isArray(files) && Object.keys(files).length > 0
    && Object.entries(files).every(([file, hash]) => typeof file === 'string' && HASH.test(hash));
}

function evidenceSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = Object.fromEntries(EVIDENCE_KEYS.map(key => [key, value[key]]));
  if (summary.complete !== true || summary.rounds !== 12 || !HASH.test(summary.sourceFingerprint)
    || summary.hardFailures !== 0
    || !HASH.test(value.summarySha256)) return null;
  summary.summarySha256 = value.summarySha256;
  return summary;
}

export function readModuleLock(lockPath, fsImpl = null) {
  const fs = fsImpl;
  if (!fs) throw new TypeError('readModuleLock requires fs');
  if (!fs.existsSync(lockPath)) return null;
  try { return JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
  catch { return { __lockReadError: 'invalid_lock_record' }; }
}

export function validateModuleLock({ record, current, evidence }) {
  if (record === null || record === undefined) return { locked: false, reason: 'no_lock_record' };
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { locked: false, reason: 'invalid_lock_record' };
  if (record.__lockReadError) return { locked: false, reason: record.__lockReadError };
  if (record.locked !== true) return { locked: false, reason: 'lock_not_marked_locked' };
  if (!current || typeof current !== 'object' || !HASH.test(current.fingerprint) || !validFiles(current.files)) return { locked: false, reason: 'current_fingerprint_missing' };
  if (record.stage !== 1 || record.version !== current.version) return { locked: false, reason: 'version_or_stage_mismatch' };
  if (!HASH.test(record.fingerprint) || record.fingerprint !== current.fingerprint) return { locked: false, reason: 'aggregate_fingerprint_mismatch' };
  if (!validFiles(record.files)) return { locked: false, reason: 'protected_files_invalid' };
  if (!sameFiles(record.files, current.files)) return { locked: false, reason: 'protected_files_changed' };
  const expected = evidenceSummary(evidence);
  const actual = evidenceSummary(record.realAcceptance);
  if (!expected || !actual || actual.sourceFingerprint !== current.fingerprint
    || expected.sourceFingerprint !== current.fingerprint
    || actual.summarySha256 !== expected.summarySha256
    || !EVIDENCE_KEYS.every(key => actual[key] === expected[key])) return { locked: false, reason: 'real_acceptance_evidence_mismatch' };
  return { locked: true, reason: 'locked', version: current.version, stage: 1, fingerprint: current.fingerprint };
}

function safeRelativePath(file) {
  return typeof file === 'string' && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u.test(file)
    && !file.split('/').some(part => part === '.' || part === '..');
}

function hex(buffer) { return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }

async function digestBytes(cryptoImpl, bytes) {
  const subtle = cryptoImpl?.subtle || cryptoImpl?.webcrypto?.subtle;
  if (!subtle) throw new Error('crypto_unavailable');
  return hex(await subtle.digest('SHA-256', bytes));
}

export async function loadModuleLock(root, version, { fetch: fetchImpl = globalThis.fetch, crypto: cryptoImpl = globalThis.crypto } = {}) {
  const fail = reason => ({ locked: false, reason });
  if (typeof fetchImpl !== 'function' || !root) return fail('lock_reader_unavailable');
  const rootText = String(root), base = rootText.endsWith('/') ? rootText : `${rootText}/`;
  const get = async relative => {
    if (!safeRelativePath(relative)) throw new Error('unsafe_lock_path');
    const response = await fetchImpl(new URL(relative, base).href, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('lock_read_failed');
    return response;
  };
  try {
    const lockResponse = await get('locks/phase1.json');
    if (!lockResponse) return fail('no_lock_record');
    const evidenceResponse = await get('locks/phase1-evidence.json');
    if (!evidenceResponse) return fail('real_acceptance_evidence_missing');
    const lockBytes = new Uint8Array(await lockResponse.arrayBuffer());
    const evidenceBytes = new Uint8Array(await evidenceResponse.arrayBuffer());
    const record = JSON.parse(new TextDecoder().decode(lockBytes));
    const evidence = JSON.parse(new TextDecoder().decode(evidenceBytes));
    const files = record?.files;
    if (!validFiles(files)) return fail('protected_files_invalid');
    const hashes = {};
    for (const file of Object.keys(files).sort()) {
      const response = await get(file);
      if (!response) return fail('protected_file_missing');
      hashes[file] = await digestBytes(cryptoImpl, await response.arrayBuffer());
    }
    const current = { version, stage: 1, fingerprint: await digestBytes(cryptoImpl, new TextEncoder().encode(JSON.stringify(hashes))), files: hashes };
    evidence.summarySha256 = await digestBytes(cryptoImpl, evidenceBytes);
    return validateModuleLock({ record, current, evidence });
  } catch { return fail('lock_read_failed'); }
}
