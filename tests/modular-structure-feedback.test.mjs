// Controlled structural feedback checks. These tests never execute MVU or a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lostObjectKeys } from '../modular/variables/core.mjs';
import { embeddedSchemaMaterial } from '../modular/host.mjs';

function missing(result, needle) {
  return result.some((entry) => (entry.missingPaths || []).some((path) => String(path).includes(needle)));
}

test('reports nested object keys silently lost by official schema', () => {
  const operations = [{ op: 'insert', path: '/actors/a', value: {
    title: { currentTitle: { name: 'actual title', effects: {} }, backup: [] },
  } }];
  const before = { actors: {} };
  const after = { actors: { a: { title: { name: '无', effects: {} } } } };
  const result = lostObjectKeys(operations, before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0].operationIndex, 0);
  assert.ok(missing(result, 'currentTitle') || missing(result, 'backup'));
});

test('allows schema defaults and scalar normalization', () => {
  assert.deepEqual(lostObjectKeys(
    [{ op: 'insert', path: '/actor', value: { title: { name: 'x' } } }],
    {}, { actor: { title: { name: 'x', effects: {} } } },
  ), []);
  assert.deepEqual(lostObjectKeys(
    [{ op: 'replace', path: '/count', value: 7 }],
    { count: 0 }, { count: '7' },
  ), []);
  assert.deepEqual(lostObjectKeys(
    [{ op: 'replace', path: '/title', value: 'x' }],
    { title: 'old' }, { title: { name: 'x', effects: {} } },
  ), []);
});

test('does not report a field that is subsequently legally removed', () => {
  const operations = [
    { op: 'insert', path: '/actor', value: { title: { name: 'x', effects: {} } } },
    { op: 'remove', path: '/actor' },
  ];
  assert.deepEqual(lostObjectKeys(operations, {}, {}), []);
});

test('checks escaped object keys and an unambiguous array append', () => {
  const escaped = lostObjectKeys(
    [{ op: 'insert', path: '/actors/a~1b', value: { title: { name: 'x', effects: {} } } }],
    { actors: {} }, { actors: { 'a/b': { title: { name: 'x' } } } },
  );
  assert.equal(escaped.length, 1);
  assert.ok(missing(escaped, 'effects'));

  const appended = lostObjectKeys(
    [{ op: 'insert', path: '/actors/-', value: { title: { name: 'x', effects: {} } } }],
    { actors: [] }, { actors: [{ title: { name: 'x' } }] },
  );
  assert.equal(appended.length, 1);
  assert.ok(missing(appended, 'effects'));
});

test('embedded schema material keeps only enabled character schema scripts', async () => {
  const source = 'registerMvuSchema(z.object({ actor: z.record(z.string()) }))';
  const helper = {
    getScriptTrees({ type }) {
      assert.equal(type, 'character');
      return [
        { type: 'folder', enabled: true, scripts: [
          { enabled: true, content: source },
          { enabled: false, content: `${source} disabled` },
        ] },
        { type: 'folder', enabled: false, scripts: [
          { enabled: true, content: `${source} hidden` },
        ] },
        { type: 'script', enabled: true, content: 'console.log("no schema")' },
      ];
    },
  };
  const ctx = {
    characterId: 0,
    characters: [{ name: 'synthetic-card', data: { extensions: { tavern_helper: { scripts: [] } } } }],
    extensionSettings: { tavern_helper: { script: { enabled: { characters: ['synthetic-card'] } } } },
  };
  const material = await embeddedSchemaMaterial(ctx, helper);
  assert.match(material, /registerMvuSchema/);
  assert.match(material, /z\.object/);
  assert.doesNotMatch(material, /disabled|hidden/);
  assert.doesNotMatch(material, /no schema/);
});

test('disabled card schema setting does not call the script getter', () => {
  let calls = 0;
  const ctx = {
    characterId: 0,
    characters: [{ name: 'synthetic-card' }],
    extensionSettings: { tavern_helper: { script: { enabled: { characters: [] } } } },
  };
  const material = embeddedSchemaMaterial(ctx, { getScriptTrees() { calls += 1; return []; } });
  assert.equal(material, '');
  assert.equal(calls, 0);
});

test('active schema configuration without the public getter fails closed', () => {
  const ctx = {
    characterId: 0,
    characters: [{ name: 'synthetic-card' }],
    extensionSettings: { tavern_helper: { script: { enabled: { characters: ['synthetic-card'] } } } },
  };
  assert.throws(() => embeddedSchemaMaterial(ctx, {}), { code: 'variable_schema_unavailable' });
});
