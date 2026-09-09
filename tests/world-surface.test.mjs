import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldSurface } from '../world/surface.mjs';

class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = {}; this.dataset = {}; this.className = ''; this.id = ''; this.open = false; this.disabled = false; this.type = ''; this.textContent = ''; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  get firstChild() { return this.children[0] || null; }
  removeChild(child) { this.children = this.children.filter(value => value !== child); child.parentNode = null; return child; }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  async click() { return this.listeners.click?.(); }
  querySelector(selector) { return walk(this, node => selector === `#${node.id}` || selector === node.tagName.toLowerCase()); }
}
function walk(node, predicate) { for (const child of node.children) { if (predicate(child)) return child; const found = walk(child, predicate); if (found) return found; } return null; }
function all(node) { return [node, ...node.children.flatMap(all)]; }
function setup() { const body = new Node('body'), settings = new Node('div'); settings.id = 'extensions_settings2'; body.appendChild(settings); globalThis.document = { body, createElement: tag => new Node(tag), querySelector: selector => selector === '#extensions_settings2' ? settings : null }; return { body, settings }; }

const record = { status: 'complete', index: 26, revision: 3, inputIdentity: 'input', variableIdentity: 'variable', profileRecordHash: 'profile', deliveries: ['d1'], heldProfiles: [{ profileId: 'private-id' }], world: { worldDigest: 'digest', events: [{ id: 1 }], factions: [], winds: [], worldTrends: [], reputation: {}, economy: {}, memories: [], enemies: [], influenceChain: [], regionalIncident: null, distantEvent: null, nearEvent: null, blackbox: { private: 'must stay folded' } } };

test('renders world status and complete world fields in an independent collapsed panel', () => {
  const { settings } = setup();
  const surface = createWorldSurface({ getStatus: () => ({ status: 'complete', stage: 3, busy: false, readback: true, round: 13, restored: false, detail: '本轮世界状态已读回' }), getRecord: () => record });
  const root = settings.querySelector('#mvu-doctor-world-root');
  assert.ok(root);
  const text = all(root).map(node => node.textContent).join('|');
  for (const field of ['世界引擎模块', '世界摘要', '事件', '组织', '世界趋势', '本轮世界状态已读回', '黑箱记录']) assert.match(text, new RegExp(field));
  assert.match(text, /private-id/u);
  const details = all(root).filter(node => node.tagName === 'DETAILS');
  assert.equal(details.length, 3);
  assert.equal(details.every(node => node.open === false), true);
  details.find(node => node.dataset.surfaceKey === 'world-record').open = true;
  details.find(node => node.dataset.surfaceKey === 'blackbox').open = true;
  surface.render({ status: 'complete', stage: 3, busy: false, readback: true, round: 13 });
  const rerendered = all(settings.querySelector('#mvu-doctor-world-root')).filter(node => node.tagName === 'DETAILS');
  assert.equal(rerendered.find(node => node.dataset.surfaceKey === 'world-record').open, true);
  assert.equal(rerendered.find(node => node.dataset.surfaceKey === 'blackbox').open, true);
  assert.equal(all(root).filter(node => node.tagName === 'BUTTON').length, 2);
  surface.dispose();
  assert.equal(settings.querySelector('#mvu-doctor-world-root'), null);
});

test('shows safe failure and preserves the last complete record for retry', async () => {
  const { settings } = setup(); let retries = 0;
  const surface = createWorldSurface({ getStatus: () => ({ status: 'complete', readback: true }), getRecord: () => record, retry: async () => { retries++; throw new Error('private endpoint'); } });
  const repair = all(settings).find(node => node.tagName === 'BUTTON' && node.textContent === '修复本轮');
  await repair.click();
  const root = settings.querySelector('#mvu-doctor-world-root');
  const text = all(root).map(node => node.textContent).join('|');
  assert.equal(retries, 1);
  assert.match(text, /world_transport/u);
  assert.match(text, /digest/u);
  assert.doesNotMatch(text, /private endpoint/u);
  surface.dispose();
});

test('does not display a previous chat record when the current snapshot is null', () => {
  const { settings } = setup(); let current = record;
  const surface = createWorldSurface({ getStatus: () => ({ status: 'complete', readback: true }), getRecord: () => current });
  current = null;
  surface.render({ status: 'idle', readback: false });
  const text = all(settings.querySelector('#mvu-doctor-world-root')).map(node => node.textContent).join('|');
  assert.match(text, /当前没有可显示的完整世界记录/u);
  assert.doesNotMatch(text, /digest/u);
  surface.dispose();
});
