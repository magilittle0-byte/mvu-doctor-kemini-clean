// Controlled checks for group-local rule material; no host or model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRuleMaterial } from '../modular/variables/groups.mjs';

const rules = [
  '  player.attributes.${STR|AGI}:',
  '    type: number',
  '    check:',
  '      - player attribute check one',
  '      - player attribute check two',
  '  enemy.attributes.${STR|AGI}:',
  '    type: number',
  '    check:',
  '      - enemy attribute check',
  '  player.loadout:',
  '    type: |- ',
  '      complete multiline declaration line one',
  '      complete multiline declaration line two',
  '    check:',
  '      - nested check line one',
  '      - nested check line two',
  '  player.weapon/name:',
  '    type: string',
  '    check:',
  '      - escaped path check',
  '  player.missing:',
  '    type: string',
  '    check:',
  '      - missing field check',
  '  unrelated.field:',
  '    type: string',
  '    check:',
  '      - unrelated check',
].join('\n');

test('group material isolates same-named leaves and expands multi-axis declarations', () => {
  const material = groupRuleMaterial(rules, {
    player: { attributes: { STR: 1, AGI: 2 } },
    enemy: { attributes: { STR: 9, AGI: 8 } },
  }, { paths: ['/player/attributes/STR', '/player/attributes/AGI'] });

  assert.match(material, /player\.attributes\.\$\{STR\|AGI\}/u);
  assert.match(material, /player attribute check one/u);
  assert.match(material, /player attribute check two/u);
  assert.doesNotMatch(material, /enemy\.attributes\.\$\{STR\|AGI\}/u);
  assert.doesNotMatch(material, /enemy attribute check/u);
});

test('ancestor material keeps the complete multiline check and excludes unrelated declarations', () => {
  const material = groupRuleMaterial(rules, {
    player: { loadout: {} },
  }, { paths: ['/player/loadout/item'] });

  assert.match(material, /player\.loadout:/u);
  assert.match(material, /complete multiline declaration line one/u);
  assert.match(material, /complete multiline declaration line two/u);
  assert.match(material, /nested check line one/u);
  assert.match(material, /nested check line two/u);
  assert.doesNotMatch(material, /unrelated\.field:/u);
  assert.doesNotMatch(material, /unrelated check/u);
});

test('escaped paths and missing current leaves retain their declaration material', () => {
  const material = groupRuleMaterial(rules, {
    player: {},
  }, { paths: ['/player/weapon~1name', '/player/missing'] });

  assert.match(material, /player\.weapon\/name:/u);
  assert.match(material, /escaped path check/u);
  assert.match(material, /player\.missing:/u);
  assert.match(material, /missing field check/u);
  assert.match(material, /\/player\/weapon~1name: /u);
  assert.match(material, /\/player\/missing: 字段不存在/u);
});
