import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { fingerprint } from './modular-fingerprint.mjs';
import { readModuleLock, validateModuleLock } from '../modular/lock.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const lockPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'locks', 'phase1.json');
const evidencePath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'locks', 'phase1-evidence.json');
const current = fingerprint(root);
const record = readModuleLock(lockPath, fs);
let evidence = null;
if (record) try {
  const bytes = fs.readFileSync(evidencePath);
  evidence = { ...JSON.parse(bytes), summarySha256: createHash('sha256').update(bytes).digest('hex') };
} catch { /* Invalid/missing independent evidence cannot validate a lock. */ }
const result = validateModuleLock({ record, current, evidence });
process.stdout.write(`${JSON.stringify({ ...result, stage: 1, currentFingerprint: current.fingerprint })}\n`);
if (record && !result.locked) process.exitCode = 1;
