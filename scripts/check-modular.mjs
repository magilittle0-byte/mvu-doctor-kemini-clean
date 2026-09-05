import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fingerprint } from './modular-fingerprint.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const current = fingerprint(root);
for (const file of Object.keys(current.files)) {
  if (/\.m?js$/u.test(file)) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe', windowsHide: true });
}
for (const file of ['manifest.json', 'package.json', 'legacy/0.9.11/manifest.json', 'legacy/0.9.11/package.json']) JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const lockDirectory = path.join(root, 'locks');
if (fs.existsSync(lockDirectory)) for (const name of fs.readdirSync(lockDirectory).filter(name => name.endsWith('.json'))) {
  const lock = JSON.parse(fs.readFileSync(path.join(lockDirectory, name), 'utf8'));
  if (lock.locked !== true) throw new Error('Lock files must represent actually locked modules');
  for (const [file, expected] of Object.entries(lock.files || {})) if (current.files[file] !== expected) throw new Error(`Frozen module changed: ${file}`);
}
console.log(JSON.stringify({ syntaxAndJson: 'pass', stage: 1, fingerprint: current.fingerprint, runtimeFileCount: Object.keys(current.files).length, realAcceptance: false }));
