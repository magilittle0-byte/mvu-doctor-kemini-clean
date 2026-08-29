#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const vendorDir = path.join(repoRoot, 'vendor', 'life-state-v5.35');

const sourceJson = path.resolve(process.argv[2] || '');
const sourceRegex = path.resolve(process.argv[3] || '');

if (!process.argv[2] || !process.argv[3]) {
  throw new Error('usage: node scripts/vendor-life-state-v5.35.mjs <ver5.35-json> <ver5.35-regex-json>');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`source file not found: ${file}`);
  return fs.readFileSync(file);
}

const sourceJsonBytes = readRequired(sourceJson);
const sourceRegexBytes = readRequired(sourceRegex);
const parsed = JSON.parse(sourceJsonBytes.toString('utf8'));

if (typeof parsed.content !== 'string') {
  throw new Error('ver5.35 JSON does not contain a string content field');
}

const extractedJsBytes = Buffer.from(parsed.content, 'utf8');
const frozenJsonName = 'life-state-v5.35.json';
const frozenRegexName = 'life-state-dual-regex-v5.35.json';
const extractedJsName = 'life-state-v5.35.js';

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(sourceJson, path.join(vendorDir, frozenJsonName));
fs.copyFileSync(sourceRegex, path.join(vendorDir, frozenRegexName));
fs.writeFileSync(path.join(vendorDir, extractedJsName), extractedJsBytes);

const provenance = {
  formatVersion: 1,
  source: {
    json: {
      fileName: path.basename(sourceJson),
      byteLength: sourceJsonBytes.byteLength,
      sha256: sha256(sourceJsonBytes),
    },
    regex: {
      fileName: path.basename(sourceRegex),
      byteLength: sourceRegexBytes.byteLength,
      sha256: sha256(sourceRegexBytes),
    },
  },
  extraction: {
    method: "Buffer.from(JSON.parse(fs.readFileSync(sourceJson, 'utf8')).content, 'utf8')",
    transformations: [],
    newlineAppended: false,
  },
  vendored: {
    json: {
      fileName: frozenJsonName,
      byteLength: sourceJsonBytes.byteLength,
      sha256: sha256(sourceJsonBytes),
    },
    regex: {
      fileName: frozenRegexName,
      byteLength: sourceRegexBytes.byteLength,
      sha256: sha256(sourceRegexBytes),
    },
    extractedJs: {
      fileName: extractedJsName,
      characterLength: parsed.content.length,
      byteLength: extractedJsBytes.byteLength,
      sha256: sha256(extractedJsBytes),
    },
  },
};

fs.writeFileSync(
  path.join(vendorDir, 'PROVENANCE.json'),
  `${JSON.stringify(provenance, null, 2)}\n`,
  'utf8',
);

console.log(`vendored ${sourceJsonBytes.byteLength} JSON bytes and ${sourceRegexBytes.byteLength} regex bytes`);
console.log(`extracted ${extractedJsBytes.byteLength} JS bytes without transformation`);
console.log(`source JSON sha256: ${provenance.source.json.sha256}`);
console.log(`source regex sha256: ${provenance.source.regex.sha256}`);
console.log(`extracted JS sha256: ${provenance.vendored.extractedJs.sha256}`);
