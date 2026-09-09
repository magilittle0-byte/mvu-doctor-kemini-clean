import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldHost } from '../world/host.mjs';
import { PROFILE_FIELDS } from '../profiles/content.mjs';

function fullProfile(id) {
  const profile = { profileId: id, rowId: `row-${id}`, name: `角色-${id}` };
  for (const field of PROFILE_FIELDS) {
    const parts = field.path.split('.'); let target = profile;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = field.type === 'list' ? [`依据-${id}-${parts.at(-1)}`] : `${id}-${parts.at(-1)}`;
  }
  return profile;
}

function fixture({ recordChange = null } = {}) {
  const branch = { index: 5, scopeKey: 'scope', lineage: 'lineage' };
  const receipt = { identity: 'variable-identity', afterHash: 'mvu-hash', readback: true,
    target: { index: 5, identity: 'target-identity', scopeKey: 'scope', scopeSignature: 'scope-signature', swipeId: 0 } };
  let record = { index: 5, scopeKey: 'scope', lineage: 'lineage', variableIdentity: receipt.identity,
    mvuHash: receipt.afterHash, status: 'complete', revision: 1,
    tasks: [{ profileId: 'bad', status: 'failed' }, { profileId: 'good', status: 'complete' }],
    profiles: [fullProfile('bad'), fullProfile('good')] };
  const api = { ready: true, status: () => ({ busy: false, readback: true, status: 'complete' }),
    read: async () => { const returned = structuredClone(record); recordChange?.(); return returned; }, record: () => structuredClone(record) };
  const base = {
    assertReceipt: async () => {}, branches: async () => [branch], playerNames: () => [],
    scope: () => ({ chatId: 'chat' }), settings: () => ({ globalPrompt: '' }),
    inputFor: async () => ({}), callModel: async () => 'ok',
  };
  return { receipt, api, base, setRecord: value => { record = value; } };
}

test('captureProfiles keeps valid complete profiles while excluding only failed tasks', async () => {
  const f = fixture(); const host = createWorldHost(f.base, () => f.api);
  const snapshot = await host.captureProfiles(f.receipt);
  assert.deepEqual(snapshot.profiles.map(profile => profile.profileId), ['good']);
  assert.deepEqual(snapshot.heldProfiles, [{ profileId: 'bad', reason: 'profile_incomplete' }]);
});

test('captureProfiles rejects a stale branch or MVU receipt', async () => {
  const f = fixture(); f.base.branches = async () => [{ index: 5, scopeKey: 'scope', lineage: 'other-lineage' }];
  const host = createWorldHost(f.base, () => f.api);
  await assert.rejects(() => host.captureProfiles(f.receipt), error => error.code === 'profiles_pending');
});

test('captureProfiles and callModel reject a profile record that changes during the operation', async () => {
  const f = fixture({ recordChange: () => { f.api.record = () => ({ changed: true }); } });
  const host = createWorldHost(f.base, () => f.api);
  await assert.rejects(() => host.captureProfiles(f.receipt), error => error.code === 'stale_profiles');

  const stable = fixture(); const live = createWorldHost(stable.base, () => stable.api);
  const snapshot = await live.captureProfiles(stable.receipt);
  stable.base.callModel = async () => { stable.setRecord({ ...stable.api.record(), revision: 2 }); return 'ok'; };
  const liveAfter = createWorldHost(stable.base, () => stable.api);
  await assert.rejects(() => liveAfter.callModel(stable.receipt, snapshot, 'prompt'), error => error.code === 'stale_profiles');
});
