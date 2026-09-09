import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadWorldDependencies } from '../world/dependencies.mjs';
import { WORLD_VERSION } from '../world/runtime.mjs';

// Minimal P3 adaptation of check-profiles.mjs; never regenerates P1/P2 files.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const demand = (ok, code) => { if (!ok) throw new Error(code); };
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(`${dir}/${entry.name}`) : /\.(?:m?js|css|json)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []).sort();
export async function worldFingerprint() {
  const dependencies = await loadWorldDependencies(new URL('../', import.meta.url), { crypto: crypto.webcrypto,
    fetch: async url => { try { return new Response(fs.readFileSync(fileURLToPath(url))); } catch { return new Response('', { status: 404 }); } } });
  demand(dependencies.locked, `LOCKED_DEPENDENCY_CHANGED:${dependencies.reason}`);
  const manifest = json('world/manifest.json');
  demand(manifest.stage === 3 && manifest.version === WORLD_VERSION && manifest.requires.length === 2
    && manifest.requires[0].fingerprint === dependencies.p1.fingerprint && manifest.requires[1].fingerprint === dependencies.p2.fingerprint, 'WORLD_MANIFEST_MISMATCH');
  const files = Object.fromEntries(walk('world').map(file => [file, sha(read(file))]));
  return { stage: 3, version: WORLD_VERSION, p1Fingerprint: dependencies.p1.fingerprint, p2Fingerprint: dependencies.p2.fingerprint,
    fingerprint: sha(JSON.stringify({ p1Fingerprint: dependencies.p1.fingerprint, p2Fingerprint: dependencies.p2.fingerprint, files })), files };
}
function loaderObject() {
  return { type: 'script', enabled: true, name: `MVU Doctor 世界引擎 ${WORLD_VERSION}`,
    id: 'c7e3bdf0-8295-4da1-ae6c-57f5f5d52703', content: read('world/loader.js').toString('utf8'),
    info: '独立世界引擎测试候选，需要已锁定的变量和人物档案模块。尚未完成真实门禁。',
    button: { enabled: true, buttons: [] }, data: {} };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write-loader')) fs.writeFileSync(path.join(root, 'world/install.json'), `${JSON.stringify(loaderObject(), null, 2)}\n`);
  demand(JSON.stringify(json('world/install.json')) === JSON.stringify(loaderObject()), 'WORLD_LOADER_STALE');
  const result = await worldFingerprint();
  for (const file of Object.keys(result.files).filter(file => /\.m?js$/.test(file)))
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe', windowsHide: true });
  execFileSync(process.execPath, [path.join(root, 'scripts/check-world-native.mjs')], { stdio: 'pipe', windowsHide: true });
  process.stdout.write(`${JSON.stringify({ ...result, dependenciesLocked: true, realAcceptance: false }, null, 2)}\n`);
}
