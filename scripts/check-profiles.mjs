import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { fingerprint } from './modular-fingerprint.mjs';
import { validateModuleLock } from '../modular/lock.mjs';
import { PROFILE_VERSION } from '../profiles/runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const demand = (ok, code) => { if (!ok) throw new Error(code); };
export function profileFingerprint() {
  const current = fingerprint(root), evidenceBytes = read('locks/phase1-evidence.json');
  const p1 = validateModuleLock({ record: json('locks/phase1.json'), current,
    evidence: { ...JSON.parse(evidenceBytes), summarySha256: sha(evidenceBytes) } });
  demand(p1.locked, 'P1_LOCK_CHANGED');
  const support = json('locks/phase1-supporting-files.json');
  demand(support.sourceFingerprint === p1.fingerprint, 'P1_SUPPORT_BINDING_CHANGED');
  for (const [file, hash] of Object.entries(support.files)) demand(sha(read(file)) === hash, `P1_SUPPORT_CHANGED:${file}`);
  const manifest = json('profiles/manifest.json');
  demand(manifest.stage === 2 && manifest.version === PROFILE_VERSION && manifest.requires.version === p1.version
    && manifest.requires.fingerprint === p1.fingerprint, 'P2_MANIFEST_MISMATCH');
  const files = Object.fromEntries(fs.readdirSync(path.join(root, 'profiles')).filter(file => /\.(?:m?js|css|json)$/.test(file)).sort()
    .map(file => [`profiles/${file}`, sha(read(`profiles/${file}`))]));
  return { stage: 2, version: manifest.version, p1Fingerprint: p1.fingerprint,
    fingerprint: sha(JSON.stringify({ p1Fingerprint: p1.fingerprint, files })), files };
}
function loaderObject() {
  return { type: 'script', enabled: true, name: `MVU Doctor 人物档案 ${PROFILE_VERSION}`,
    id: '07fa62d8-6e38-40c5-9ed4-50510aef21b0', content: read('profiles/loader.js').toString('utf8'),
    info: '独立人物档案测试候选。需要同一安装目录中的已锁定 P1 0.10.26；普通正文后自主建档、填表及召回。尚未完成真实门禁。',
    button: { enabled: true, buttons: [] }, data: {} };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write-loader')) fs.writeFileSync(path.join(root, 'profiles/install.json'), `${JSON.stringify(loaderObject(), null, 2)}\n`);
  demand(JSON.stringify(json('profiles/install.json')) === JSON.stringify(loaderObject()), 'P2_LOADER_STALE');
  const result = profileFingerprint();
  for (const file of Object.keys(result.files).filter(file => /\.m?js$/.test(file))) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe', windowsHide: true });
  }
  process.stdout.write(`${JSON.stringify({ ...result, p1Locked: true, supportingFilesUnchanged: true, realAcceptance: false }, null, 2)}\n`);
}
