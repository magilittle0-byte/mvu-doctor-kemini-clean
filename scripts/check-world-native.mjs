import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(repo, 'vendor', 'world-engine-v3.0.2');
const output = path.join(repo, 'world', 'native');
const specs = [
  ['core', 'installNativeCore', 'WORLD_ENGINE_CORE', 'world-engine-core.js'],
  ['evolution', 'installNativeEvolution', 'WORLD_ENGINE_EVOLUTION', 'world-engine-evolution.js'],
  ['rules', 'installNativeRules', 'WORLD_ENGINE_RULES', 'world-engine-rules-loader.js'],
  ['ledger', 'installNativeLedger', 'WORLD_ENGINE_LEDGER', 'world-engine-ledger.js']
];

function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makeWrapper(install, globalName, sourceName, sourceText) {
  const source = sourceText.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const prefix = `window.${globalName} = (function() {`;
  const start = source.indexOf(prefix);
  const end = source.lastIndexOf('})();');
  if (start < 0 || end < start) throw new Error(`SOURCE_SHAPE_${sourceName}`);
  const body = source.slice(start + prefix.length, end);
  return `// Generated from vendor/world-engine-v3.0.2/${sourceName}; source body is preserved verbatim after CRLF to LF normalization.\nexport function ${install}(window, SillyTavern, console) {\n  window.${globalName} = (function() {${body}\n  })();\n  return window.${globalName};\n}\n`;
}

let failed = false;
for (const [name, install, globalName, sourceName] of specs) {
  const sourceBytes = fs.readFileSync(path.join(vendor, sourceName));
  const generated = Buffer.from(makeWrapper(install, globalName, sourceName, sourceBytes.toString('utf8')), 'utf8');
  const outputBytes = fs.readFileSync(path.join(output, `${name}.mjs`));
  const equal = generated.equals(outputBytes);
  failed ||= !equal;
  console.log(JSON.stringify({ name, source: sha(sourceBytes), generated: sha(generated), actual: sha(outputBytes), sourceBytes: sourceBytes.length, generatedBytes: generated.length, lines: generated.toString('utf8').split('\n').length - 1, exact: equal }));
}
if (failed) process.exitCode = 1;
