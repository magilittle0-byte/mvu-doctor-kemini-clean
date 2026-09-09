import { createProfileHost } from '../profiles/host.mjs';
import { validateProfile } from '../profiles/content.mjs';
import { clone, digest, equal, fault } from '../modular/variables/core.mjs';

// P1/P2 remain the only writers of their facts. See PHASE3_SOURCE_MAP.md.
export function createWorldHost(base = createProfileHost(), getProfiles = () => globalThis.MVUDoctorProfiles) {
  async function captureProfiles(receipt, signal) {
    await base.assertReceipt(receipt, signal);
    const api = getProfiles(), status = api?.status?.();
    if (!api?.ready || status?.busy) throw fault('profiles_pending', '正在等待本轮人物档案');
    const branch = (await base.branches()).find(item => item.index === receipt.target.index);
    const record = await api.read();
    if (!branch || !record || record.scopeKey !== branch.scopeKey || record.lineage !== branch.lineage
      || record.index !== receipt.target.index || record.variableIdentity !== receipt.identity
      || record.mvuHash !== receipt.afterHash) throw fault('profiles_pending', '本轮人物档案尚未与当前正文和变量对齐');
    if (!status.readback || !['complete', 'partial'].includes(record.status)
      || !['complete', 'partial', 'restored'].includes(status.status))
      throw fault('profiles_unavailable', '人物档案本轮未完成，请先修复档案');
    if (!equal(record, api.record())) throw fault('stale_profiles', '人物档案已变化，正在等待新的读回');
    const failed = new Set(record.tasks.filter(task => task.status !== 'complete').map(task => task.profileId));
    const players = base.playerNames(receipt.target);
    const profiles = record.profiles.filter(profile => !failed.has(profile.profileId) && !validateProfile(profile, players).length);
    const heldProfiles = record.tasks.filter(task => task.status !== 'complete')
      .map(task => ({ profileId: task.profileId, reason: 'profile_incomplete' }));
    for (const profile of record.profiles) if (!failed.has(profile.profileId) && validateProfile(profile, players).length)
      heldProfiles.push({ profileId: profile.profileId, reason: 'profile_incomplete' });
    await base.assertReceipt(receipt, signal);
    if (getProfiles() !== api || api.status().busy || !equal(record, api.record()))
      throw fault('stale_profiles', '人物档案读取期间发生变化');
    return { branch, profileRecordHash: await digest(record), profiles: clone(profiles), heldProfiles };
  }
  async function assertSnapshot(receipt, snapshot, signal) {
    const current = await captureProfiles(receipt, signal);
    if (current.profileRecordHash !== snapshot.profileRecordHash || !equal(current.branch, snapshot.branch))
      throw fault('stale_profiles', '人物档案已重新修复，旧世界候选停止写入');
  }
  async function inputFor(receipt, snapshot, signal) {
    await assertSnapshot(receipt, snapshot, signal);
    const input = await base.inputFor(receipt, snapshot.profiles, base.settings().globalPrompt, signal);
    await assertSnapshot(receipt, snapshot, signal);
    return { ...input, heldProfiles: clone(snapshot.heldProfiles), profileRecordHash: snapshot.profileRecordHash };
  }
  async function callModel(receipt, snapshot, prompt, signal) {
    await assertSnapshot(receipt, snapshot, signal);
    const raw = await base.callModel(receipt, prompt, signal);
    await assertSnapshot(receipt, snapshot, signal);
    return raw;
  }
  return Object.freeze({ ...base, profilesApi: getProfiles, captureProfiles, assertSnapshot, inputFor, callModel });
}
