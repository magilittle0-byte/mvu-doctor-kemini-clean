import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export function fingerprint(repo = root) {
  const paths = ['manifest.json'];
  for (const directory of ['modular', 'vendor/story-oracle-v1.35.4']) {
    const walk = relative => {
      for (const name of fs.readdirSync(path.join(repo, relative)).sort()) {
        const file = `${relative}/${name}`;
        if (fs.statSync(path.join(repo, file)).isDirectory()) walk(file);
        else if (/\.(?:m?js|css)$/u.test(name)) paths.push(file);
      }
    };
    walk(directory);
  }
  const hashes = Object.fromEntries(paths.sort().map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')]));
  return { version: JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'))).version, stage: 1,
    fingerprint: crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), files: hashes };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(fingerprint(), null, 2)}\n`);
