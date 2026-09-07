import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fingerprint } from './modular-fingerprint.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const current = fingerprint(root);
for (const file of Object.keys(current.files)) {
  if (/\.m?js$/u.test(file)) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe', windowsHide: true });
  if (/\.json$/u.test(file)) JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}
for (const file of ['manifest.json', 'package.json', 'legacy/0.9.11/manifest.json', 'legacy/0.9.11/package.json']) JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const lockDirectory = path.join(root, 'locks');
if (fs.existsSync(path.join(lockDirectory, 'phase1.json'))) execFileSync(process.execPath, ['scripts/validate-module-lock.mjs'], { cwd: root, stdio: 'pipe', windowsHide: true });
console.log(JSON.stringify({ syntaxAndJson: 'pass', stage: 1, fingerprint: current.fingerprint, runtimeFileCount: Object.keys(current.files).length, realAcceptance: false }));
