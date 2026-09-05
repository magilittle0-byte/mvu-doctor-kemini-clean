import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL(`../${manifest.js}`, import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('运行时、manifest与package共享同一个发布版本', () => {
  const match = source.match(/const VERSION = '([^']+)';/u);
  assert.ok(match, 'manifest选择的运行入口必须声明唯一VERSION');
  assert.equal(manifest.js, 'modular/entry.js', '第一阶段只加载独立模块入口');
  assert.doesNotMatch(source, /profile-engine\.js|world-engine\.js/);
  assert.equal(
    match[1],
    manifest.version,
    `实际入口VERSION（${match[1]}）必须与manifest（${manifest.version}）一致`,
  );
  assert.equal(
    packageJson.version,
    manifest.version,
    `package.json版本（${packageJson.version}）必须与manifest（${manifest.version}）一致`,
  );
});
