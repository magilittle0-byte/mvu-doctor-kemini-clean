import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const corePath = path.join(root, 'core.mjs');
const indexPath = path.join(root, 'index.js');
const manifestPath = path.join(root, 'manifest.json');
const packagePath = path.join(root, 'package.json');
const startMarker = '  /* MVU_KEMINI_EMBEDDED_CORE_START */';
const endMarker = '  /* MVU_KEMINI_EMBEDDED_CORE_END */';

function releaseVersion() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const manifestVersion = String(manifest.version || '').trim();
  const packageVersion = String(packageJson.version || '').trim();
  if (!manifestVersion) throw new Error('manifest.json version is missing');
  if (packageVersion !== manifestVersion) {
    throw new Error(`package.json version ${packageVersion || '(missing)'} does not match manifest ${manifestVersion}`);
  }
  return manifestVersion;
}

function withRuntimeVersion(indexSource, version) {
  const pattern = /const DOCTOR_VERSION = '([^']+)';/gu;
  const matches = [...indexSource.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`expected exactly one DOCTOR_VERSION declaration, found ${matches.length}`);
  return indexSource.replace(pattern, `const DOCTOR_VERSION = '${version}';`);
}

function embeddedCoreBlock(coreSource) {
  const exportNames = [...coreSource.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1]);
  if (!exportNames.includes('generateTicketBatch') || !exportNames.includes('prepareProfileBatch')) {
    throw new Error('core export discovery failed');
  }
  const stripped = coreSource.replace(/^export\s+/gm, '');
  const body = stripped.split(/\r?\n/).map((line) => (line ? `    ${line}` : '')).join('\n');
  return [
    startMarker,
    '  // Generated from core.mjs. The Tavern runtime is deliberately self-contained:',
    '  // some extension loaders execute index.js without an active script element.',
    '  const embeddedCore = (() => {',
    body,
    `    return Object.freeze({ ${exportNames.join(', ')} });`,
    '  })();',
    endMarker,
  ].join('\n');
}

function nextIndex(indexSource, coreSource, version) {
  const block = embeddedCoreBlock(coreSource);
  let next = withRuntimeVersion(indexSource, version);
  const start = next.indexOf(startMarker);
  const end = next.indexOf(endMarker);
  if (start >= 0 || end >= 0) {
    if (start < 0 || end < start) throw new Error('embedded core marker mismatch');
    next = `${next.slice(0, start)}${block}${next.slice(end + endMarker.length)}`;
  } else {
    const locator = "  const scriptUrl = document.currentScript?.src || '';";
    if (!next.includes(locator)) throw new Error('legacy script locator not found');
    next = next.replace(locator, block);
  }
  next = next.replace("    if (!scriptUrl) throw new Error('无法定位扩展core.mjs');\n", '');
  next = next.replace("    runtime.core = await import(new URL('./core.mjs', scriptUrl).href);", '    runtime.core = embeddedCore;');
  return next;
}

const current = fs.readFileSync(indexPath, 'utf8');
const version = releaseVersion();
const expected = nextIndex(current, fs.readFileSync(corePath, 'utf8'), version);
if (process.argv.includes('--check')) {
  if (current !== expected) {
    console.error('index.js embedded core is stale; run npm run build:runtime');
    process.exit(1);
  }
  if (/document\.currentScript|import\s*\(\s*new URL\(['"]\.\/core\.mjs/.test(current)) {
    console.error('index.js still depends on runtime path discovery');
    process.exit(1);
  }
  console.log(`verified: index.js embeds current core, runtime version ${version}, and has no runtime core.mjs lookup`);
} else {
  fs.writeFileSync(indexPath, expected, 'utf8');
  console.log(`built self-contained index.js from core.mjs at runtime version ${version}`);
}
