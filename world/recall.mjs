import { digest, clone, canonical } from '../modular/variables/core.mjs';

const PUBLIC_EVENT_LEVEL = 3;
const TERMINAL = new Set(['已爆发', '已完成', '已失败', '已消散']);
const text = value => typeof value === 'string' ? value.trim() : String(value ?? '').trim();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function publicEvent(value) {
  const source = object(value);
  const level = Number(source.level || 0);
  const stage = text(source.stage);
  if (level < PUBLIC_EVENT_LEVEL && !TERMINAL.has(stage)) return null;
  return {
    id: text(source.id) || text(source.name), name: text(source.name), type: text(source.type),
    level, stage, evolveResult: text(source.evolveResult),
    desc: text(source.desc),
  };
}
function publicWind(value) {
  const source = object(value);
  if (Number(source.level || 0) < PUBLIC_EVENT_LEVEL) return null;
  return { id: text(source.id) || text(source.topic), topic: text(source.topic), type: text(source.type),
    level: Number(source.level || 0), scope: text(source.scope), content: text(source.content), source: text(source.source) };
}
function publicWorld(value) {
  const source = object(value);
  const regional = object(source.regionalIncident);
  const economy = object(source.economy);
  const events = (Array.isArray(source.events) ? source.events : []).map(publicEvent).filter(Boolean);
  return {
    events,
    winds: (Array.isArray(source.winds) ? source.winds : []).map(publicWind).filter(Boolean),
    regionalIncident: regional.active === true ? { active: true, title: text(regional.title), type: text(regional.type), scope: text(regional.scope), impact: text(regional.impact) } : null,
    economySignals: (Array.isArray(economy.signals) ? economy.signals : []).map(signal => ({ summary: text(signal?.summary), scope: text(signal?.scope) })).filter(signal => signal.summary),
  };
}
function eventKey(value) { return text(value?.id) || text(value?.name) || text(value?.topic)
  || text(value?.title) || canonical({ summary: value?.summary || '', scope: value?.scope || '' }); }
function changed(after, before) { return canonical(after) !== canonical(before); }
function sourceFields(source = {}) { return { sourceScopeKey: text(source.scopeKey), sourceLineage: text(source.lineage), index: Number(source.index ?? -1), inputIdentity: text(source.inputIdentity) }; }

function eventContent(kind, value, prior = null) {
  if (kind === 'event') return [value.name || '公开事件', value.stage || '状态更新', value.desc || value.evolveResult].filter(Boolean).join('：');
  if (kind === 'wind') return [value.topic || '公开风声', value.content].filter(Boolean).join('：');
  if (kind === 'regional') return [value.title || '区域环境变化', value.impact].filter(Boolean).join('：');
  return [prior?.summary ? '环境信号更新' : '公开环境信号', value.summary, value.scope].filter(Boolean).join('：');
}

/** Build only newly visible or changed public consequences. */
export async function buildDeliveries({ before = {}, world = {}, previous = [], source = {} } = {}) {
  const beforePublic = publicWorld(before), afterPublic = publicWorld(world), prior = new Map((Array.isArray(previous) ? previous : []).map(item => [item.id, clone(item)]));
  // Terminal rows can leave native state.events in the same successful merge.
  const terminal = (world.lastEvolveResult?.events || []).filter(item => TERMINAL.has(item.stage)).map(publicEvent).filter(Boolean);
  const ledger = (world.memories || []).filter(row => row.type === 'ledger' && row.round === world.round)
    .flatMap(row => row.changes || []).filter(row => row.type === 'event_terminal');
  for (const [index, row] of ledger.entries()) {
    if (terminal.some(item => item.name === row.name)) continue;
    const matches = beforePublic.events.filter(item => item.name === row.name);
    const old = matches.length === 1 ? matches[0] : null;
    const item = publicEvent({ id: old?.id || `ledger:${world.round}:${index}`, name: row.name,
      type: row.eventType || old?.type, level: row.level, stage: row.stage || row.toStage, desc: row.desc });
    if (item) terminal.push(item);
  }
  for (const item of terminal) if (!afterPublic.events.some(existing => eventKey(existing) === eventKey(item))) afterPublic.events.push(item);
  const candidates = [];
  const add = (kind, value, priorValue = null) => {
    const content = eventContent(kind, value, priorValue);
    if (!content) return;
    candidates.push({ kind, value, priorValue, content });
  };
  const oldEvents = new Map(beforePublic.events.map(item => [eventKey(item), item]));
  for (const item of afterPublic.events) { const old = oldEvents.get(eventKey(item)); if (!old || changed(item, old)) add('event', item, old); }
  const oldWinds = new Map(beforePublic.winds.map(item => [eventKey(item), item]));
  for (const item of afterPublic.winds) { const old = oldWinds.get(eventKey(item)); if (!old || changed(item, old)) add('wind', item, old); }
  if (afterPublic.regionalIncident && changed(afterPublic.regionalIncident, beforePublic.regionalIncident)) add('regional', afterPublic.regionalIncident, beforePublic.regionalIncident);
  const oldSignals = new Map(beforePublic.economySignals.map(item => [canonical(item), item]));
  for (const item of afterPublic.economySignals) if (!oldSignals.has(canonical(item))) add('environment', item, null);
  const base = sourceFields(source);
  const fresh = [];
  for (const candidate of candidates) {
    const payload = { scopeKey: base.sourceScopeKey, kind: candidate.kind,
      entityId: eventKey(candidate.value) || candidate.kind, content: candidate.content };
    const id = await digest(payload);
    if (prior.has(id)) { fresh.push(prior.get(id)); continue; }
    const evidenceTerms = [candidate.value?.desc,
      candidate.value?.content, candidate.value?.impact, candidate.value?.summary]
      .map(text).filter(value => value.length >= 4);
    fresh.push({ id, kind: candidate.kind, content: candidate.content, public: clone(candidate.value), ...base,
      status: 'pending', evidenceTerms: [...new Set(evidenceTerms)] });
  }
  const existing = Array.isArray(previous) ? previous.map(clone) : [];
  for (const next of fresh) {
    if (existing.some(item => item?.id === next.id)) continue;
    for (const old of existing) if (['pending', 'retained'].includes(old?.status) && old.kind === next.kind
      && old.sourceScopeKey === next.sourceScopeKey && eventKey(old.public) === eventKey(next.public)
      && old.content !== next.content) old.status = 'superseded';
    existing.push(next);
  }
  return existing;
}

export async function makeRecall(record) {
  const deliveries = Array.isArray(record?.deliveries) ? record.deliveries : [];
  const pending = deliveries.filter(item => ['pending', 'retained'].includes(item?.status) && item?.content && item?.id);
  if (!pending.length) return null;
  const unique = [...new Map(pending.map(item => [item.id, item])).values()];
  const textValue = ['<World_Recall>', '以下是已有世界变化或可见后果，请沿当前场景自然呈现；不能替玩家选择、再次执行已发生成本或泄漏内幕。未呈现的记录会保留供后续召回，不代表事件再次发生。', ...unique.map(item => `- ${item.content}`), '</World_Recall>'].join('\n');
  return { text: textValue, promptHash: await digest(textValue), deliveryIds: unique.map(item => item.id), sourceLineage: text(record?.lineage), sourceScopeKey: text(record?.scopeKey) };
}

function proofMatches(recall, receipt) {
  const target = receipt?.target || {};
  return Boolean(recall?.generationId && recall?.targetIdentity && recall?.promptObserved === true
    && recall?.scope === text(target.scopeSignature)
    && recall?.targetIdentity === text(target.identity)
    && recall?.sourceScopeKey === text(target.scopeKey)
    && receipt?.readback === true);
}

export async function settleDeliveries(deliveries, recall, receipt) {
  const rows = Array.isArray(deliveries) ? deliveries : [];
  if (!proofMatches(recall, receipt)) return clone(rows);
  const body = text(receipt?.target?.content || '');
  const target = receipt?.target || {};
  const acceptedProof = { generationId: text(recall.generationId), receiptIdentity: text(receipt.identity), targetIdentity: text(target.identity), index: Number(target.index ?? -1), swipe: Number(target.swipeId ?? 0), bodyHash: await digest(body), promptHash: text(recall.promptHash) };
  const selected = new Set(recall.deliveryIds || []);
  return rows.map(item => {
    if (!selected.has(item?.id) || item.status === 'consumed' || item.status === 'expired') return clone(item);
    const terms = Array.isArray(item.evidenceTerms) ? item.evidenceTerms.filter(term => text(term).length >= 4) : [];
    const narrativeEvidenceMatched = terms.some(term => body.includes(term));
    return { ...clone(item), acceptedProof, narrativeEvidenceMatched, semanticConsumptionProven: false, status: narrativeEvidenceMatched ? 'consumed' : 'retained' };
  });
}

export const recallInternals = Object.freeze({ publicWorld });
