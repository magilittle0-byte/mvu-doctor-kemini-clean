import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const version = file => read(file).toString('utf8').match(/(?:const|export const) (?:VERSION|PROFILE_VERSION|WORLD_VERSION) = '([^']+)'/)?.[1];

export function appFingerprint() {
  const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(`${dir}/${entry.name}`) : /\.(?:m?js|css|json)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
  const paths = ['manifest.json', 'style.css', 'locks/phase1.json', 'locks/phase1-evidence.json',
    ...['app', 'modular', 'profiles', 'world', 'compatibility', 'vendor/story-oracle-v1.35.4'].flatMap(walk)];
  const files = Object.fromEntries([...new Set(paths)].sort().map(file => [file, sha(read(file))]));
  const manifest = JSON.parse(read('manifest.json'));
  const p1Version = version('modular/entry.js'), p2Version = version('profiles/runtime.mjs'), p3Version = version('world/runtime.mjs');
  const profiles = JSON.parse(read('profiles/manifest.json')), world = JSON.parse(read('world/manifest.json'));
  if (manifest.js !== 'app/entry.js' || manifest.css !== 'app/style.css'
    || version(manifest.js) !== manifest.version || JSON.parse(read('package.json')).version !== manifest.version
    || profiles.version !== p2Version || profiles.requires.version !== p1Version
    || world.version !== p3Version || world.requires[0].version !== p1Version || world.requires[1].version !== p2Version)
    throw new Error('APP_COMPONENT_VERSION_MISMATCH');
  return { version: manifest.version, bundleFingerprint: sha(JSON.stringify(files)), files,
    p1Version, p2Version, p3Version, realAcceptance: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = appFingerprint();
  for (const file of Object.keys(result.files)) {
    if (/\.m?js$/.test(file)) execFileSync(process.execPath, ['--check', path.join(root, file)], { windowsHide: true, stdio: 'pipe' });
    if (/\.json$/.test(file)) JSON.parse(read(file));
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
