// Controlled checks for group-local rule material; no host or model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRuleMaterial, planVariableGroups } from '../modular/variables/groups.mjs';

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

test('container ranges are atomic while scalar ranges retain the eight-path limit', () => {
  const scalarNames = Array.from({ length: 10 }, (_, index) => `s${index}`);
  const rules = [
    '  actor.profile:',
    '    check: profile',
    '  actor.inventory:',
    '    check: inventory',
    '  actor.emptyObject:',
    '    check: empty object',
    '  actor.emptyArray:',
    '    check: empty array',
    '  actor.previousObject:',
    '    check: previous object',
    ...scalarNames.flatMap(name => [`  actor.${name}:`, '    check: scalar']),
  ].join('\n');
  const current = {
    actor: {
      profile: { name: 'ready', nested: { value: 1 } },
      inventory: ['item'],
      emptyObject: {},
      emptyArray: [],
      previousObject: 'malformed',
      ...Object.fromEntries(scalarNames.map((name, index) => [name, index])),
    },
  };
  const previous = {
    actor: {
      profile: { name: 'old' },
      inventory: ['old-item'],
      emptyObject: {},
      emptyArray: [],
      previousObject: { retained: true },
    },
  };
  const groups = planVariableGroups(rules, current, previous, 8);
  const paths = groups.flatMap(group => group.paths);
  const expected = new Set([
    '/actor/profile', '/actor/inventory', '/actor/emptyObject',
    '/actor/emptyArray', '/actor/previousObject',
    ...scalarNames.map(name => `/actor/${name}`),
  ]);
  assert.deepEqual(new Set(paths), expected, 'every computed range appears exactly once');
  assert.equal(paths.length, expected.size, 'no path is duplicated across groups');
  const containerPaths = new Set([
    '/actor/profile', '/actor/inventory', '/actor/emptyObject',
    '/actor/emptyArray', '/actor/previousObject',
  ]);
  for (const path of containerPaths) {
    const owner = groups.filter(group => group.paths.includes(path));
    assert.equal(owner.length, 1, `${path} has one owning group`);
    assert.deepEqual(owner[0].paths, [path], `${path} is not bundled with another range`);
  }
  const scalarGroups = groups.filter(group => group.paths.every(path => !containerPaths.has(path)));
  assert.ok(scalarGroups.length >= 2, 'ten scalar paths require multiple scalar groups');
  assert.ok(scalarGroups.every(group => group.paths.length <= 8), 'scalar groups retain the width bound');
  assert.ok(scalarGroups.every(group => group.paths.every(path => expected.has(path))), 'scalar groups contain only planned paths');
});
