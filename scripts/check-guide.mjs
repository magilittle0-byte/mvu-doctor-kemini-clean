import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function guideFingerprint() {
  const manifest = JSON.parse(read('manifest.json'));
  const files = Object.fromEntries(['manifest.json', ...fs.readdirSync(path.join(root, 'guide'))
    .filter(file => /\.(?:m?js|css)$/u.test(file)).map(file => `guide/${file}`)]
    .sort().map(file => [file, sha(read(file))]));
  if (manifest.js !== 'guide/entry.js' || manifest.css !== 'guide/style.css'
    || !read(manifest.js).toString().includes(`VERSION = '${manifest.version}'`)
    || JSON.parse(read('package.json')).version !== manifest.version) throw new Error('GUIDE_VERSION_MISMATCH');
  for (const file of Object.keys(files).filter(file => /\.m?js$/u.test(file))) {
    const source = read(file).toString();
    const imports = [...source.matchAll(/(?:import\s+(?:[^'"\n]+\s+from\s+)?|import\s*\()(['"])([^'"]+)\1/gu)].map(match => match[2]);
    for (const specifier of imports) {
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(root, path.dirname(file), specifier);
        if (!resolved.startsWith(path.join(root, 'guide') + path.sep) || !fs.existsSync(resolved))
          throw new Error('GUIDE_IMPORT_OUTSIDE_OWN_MODULES');
      } else if (specifier !== '/scripts/openai.js') throw new Error('GUIDE_UNVERIFIED_IMPORT');
    }
    execFileSync(process.execPath, ['--check', path.join(root, file)], { windowsHide: true, stdio: 'pipe' });
  }
  return { version: manifest.version, bundleFingerprint: sha(JSON.stringify(files)), files, realAcceptance: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.stdout.write(`${JSON.stringify(guideFingerprint(), null, 2)}\n`);
