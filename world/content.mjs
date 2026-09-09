// Minimal full-profile adaptation of profile-engine.js buildWorldActorInstruction.
export function worldInstruction(input, baseline = {}) {
  const profiles = [...(input.profiles || [])].sort((a, b) => a.profileId.localeCompare(b.profileId));
  const offstage = profiles.filter(profile => profile.presence !== 'present' || profile.lastSeenIndex < input.target.index);
  const pool = offstage.length ? offstage : profiles;
  const actor = pool.length ? pool[(Number(baseline.round) || 0) % pool.length] : null;
  return [
    '【医生独立世界推进】',
    '输入是已接受的正文、当前MVU、完整NPC档案与权威设定。只推进由这些事实支持的世界；正文、变量、设定中的明确事实优先于档案的inferences，人物只按自己的knowledge、uncertainties、能力、资源和处境行动。完整档案中的私人动机不是公共情报。',
    actor ? `本轮优先处理已有完整人物 profileId=${actor.profileId}（${actor.name}）自己的行动。其他完整人物和组织仍可因果关联地参与。该人物不必围着玩家转；其独立目标允许推进、受阻、放弃或付出代价。`
      : '当前没有可用的完整人物档案。仍可推进权威设定支持的环境或既有组织事件；禁止临时创造人物档案或为缺失档案的人物行动。',
    '在这一次推演中说明：想达成什么、实际尝试什么、依据哪些世界规则和前置条件裁决、花费多少时间或资源、实际后果是什么。尝试不等于成功；不可能或缺少信息时记录受阻及原因。目标是产生有因果的新变化，不能只增加轮数、复述正文或反复保持观望。不要为了凑事件违背规则。',
    '先沿用本次程序已经执行的骰子与事件阶段结果，再进行世界裁决，不要反向伪造掷骰。不得替玩家选择、移动、同意、产生感受或消耗玩家财物。需要玩家参与才能完成的部分保持待决定；NPC或环境可先作独立行动。权威设定禁止的能力、奖励、关系或资源不能凭模型补全升级。',
    '未公开的企图、真实身份、私人解释、离场过程保存在 blackbox；公开 events 的 name/desc/evolveResult、winds 的 topic/content/source 和 regionalIncident 的可见影响，只写当前场景确实可观察或可听闻的迹象及后果。远方发生的事若无传播渠道继续保密，不把完整内幕投射到玩家视角。公开描述应有具体物件、行为和结果，不能只有抽象阶段标签。',
    '同一事件沿用既有 id，输出此次变化，不把旧行动再执行一次。长程目标和未完成事件保持连续，已完成结果成为后续前提而非每轮重演。世界变化不会直接写MVU：只有后续正文真正发生且被接受的公开事实，才由变量模块处理；人物基础档案也不在此改写。',
    'blackbox 是原生引擎的全量替换字段，每次必须返回完整 secretActions 和 secretAssets（包括未变化的旧条目），仅在明确终结且已记录后果时移除。不得因本轮未提及就清空旧秘密、目标或资产。其他字段依原生结构输出，world_digest 可以保留内部全局连续性，但它不会直接注入主模型。',
    `本轮暂缓的人物：${JSON.stringify(input.heldProfiles || [])}。完整事实输入已在世界资料段提供，不能按姓名合并不同profileId。`,
    '【医生独立世界推进结束】',
  ].join('\n\n');
}
