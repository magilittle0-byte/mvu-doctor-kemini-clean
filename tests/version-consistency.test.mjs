import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const profileSource = fs.readFileSync(new URL('../profile-engine.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('运行时、manifest与package共享同一个发布版本', () => {
  const match = source.match(/const VERSION = '([^']+)';/u);
  const profileMatch = profileSource.match(/const ENGINE_VERSION = '([^']+)';/u);
  assert.ok(match, 'index.js必须声明唯一VERSION');
  assert.ok(profileMatch, 'profile-engine.js必须声明唯一ENGINE_VERSION');
  assert.equal(
    match[1],
    manifest.version,
    `index.js的VERSION（${match[1]}）必须与manifest（${manifest.version}）一致`,
  );
  assert.equal(profileMatch[1], manifest.version, 'profile-engine.js的ENGINE_VERSION必须与manifest一致');
  assert.equal(
    packageJson.version,
    manifest.version,
    `package.json版本（${packageJson.version}）必须与manifest（${manifest.version}）一致`,
  );
});
