// Stage 1 only. No profile creation, world evolution, or local MVU executor.
export const MODULE_VERSION = '1.0.0-candidate.1';
export const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const equal = (a, b) => canonical(a) === canonical(b);
export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function fault(code, message) { return Object.assign(new Error(message), { code }); }
export function pointerParts(path) {
  if (typeof path !== 'string' || (path && !path.startsWith('/'))) throw fault('invalid_path', '修复路径必须是根相对JSON指针');
  return path ? path.slice(1).split('/').map(part => {
    if (/~(?![01])/u.test(part)) throw fault('invalid_path', '修复路径包含无效转义');
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  }) : [];
}
export const pointer = parts => parts.length ? `/${parts.map(p => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}` : '';
export function at(value, parts) {
  for (const key of parts) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
export function usable(payload) {
  return Boolean(payload?.stat_data && typeof payload.stat_data === 'object' && !Array.isArray(payload.stat_data) && Object.keys(payload.stat_data).length);
}

// Life State ver5.35's fence -> balanced candidate -> punctuation/trailing
// comma recovery. Adapted to arrays; never evaluates JavaScript/model code.
function balancedCandidates(source) {
  const candidates = [];
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '[' && source[start] !== '{') continue;
    const stack = []; let quoted = false, escaped = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
      if (c === '"') { quoted = true; continue; }
      if (c === '[' || c === '{') stack.push(c);
      else if (c === ']' || c === '}') {
        if (stack.pop() !== (c === ']' ? '[' : '{')) break;
        if (!stack.length) { candidates.push(source.slice(start, i + 1)); start = i; break; }
      }
    }
  }
  return candidates;
}
export function parsePatch(raw) {
  const source = String(raw || '').trim();
  if (/^\[(?:(?:api|http|request)\s*)?(?:error|failed|failure|错误|失败)\]/iu.test(source)) throw fault('model_transport', '模型返回了运输错误，未形成诊断');
  const blocks = [...source.matchAll(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch>/giu)];
  if (blocks.length > 1) throw fault('patch_ambiguous', '模型返回多组修复，无法确定唯一补丁');
  const payload = (blocks[0]?.[1] ?? source).trim().replace(/^```(?:json)?\s*|\s*```$/giu, '');
  const variants = [payload, payload.replace(/[“”]/g, '"').replace(/，/g, ',').replace(/：/g, ':')];
  const values = [];
  for (const variant of variants) {
    for (const candidate of [variant, ...balancedCandidates(variant)]) {
      for (const form of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
        try {
          const value = JSON.parse(form);
          if (Array.isArray(value) && !values.some(v => equal(v, value))) values.push(value);
        } catch { /* try next purely syntactic recovery */ }
      }
    }
    if (values.length) break;
  }
  if (values.length !== 1) throw fault('patch_format', '没有取得唯一完整的JSON修复数组');
  const operations = values[0];
  for (const operation of operations) {
    if (!operation || !['replace', 'delta', 'insert', 'remove', 'move'].includes(operation.op)) throw fault('patch_operation', '补丁操作不符合当前MVU输出协议');
    pointerParts(operation.op === 'move' ? (operation.to ?? operation.path) : operation.path);
    if (operation.op === 'move') pointerParts(operation.from);
    if (['replace', 'delta', 'insert'].includes(operation.op) && !Object.hasOwn(operation, 'value')) throw fault('patch_value', '补丁缺少要写入的值');
    if (operation.op === 'delta' && (typeof operation.value !== 'number' || !Number.isFinite(operation.value))) throw fault('patch_delta', '增量必须是有效数字');
  }
  return { operations, block: `<UpdateVariable>\n<JSONPatch>\n${JSON.stringify(operations)}\n</JSONPatch>\n</UpdateVariable>` };
}

function expandPath(path) {
  const match = path.match(/\$\{([^{}]+)\}/u);
  if (!match) return [path.split('.')];
  return match[1].split('|').flatMap(part => expandPath(path.replace(match[0], part)));
}
const escapedRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mentions(sentence, key) {
  // Chinese rule prose commonly touches the identifier without whitespace.
  // Keep ASCII identifier boundaries so EXP cannot match PEXP.
  return new RegExp(`(?:^|[^A-Za-z0-9_])${escapedRegex(key)}(?:$|[^A-Za-z0-9_])`, 'u').test(sentence);
}

// Compile only explicit field-ownership declarations in a path/check rule
// document. This does not classify free narrative or infer story outcomes.
// A leaf name is never blocked outside its declared object (enemies can have
// AI-owned fields bearing the same names as player/frontend-owned fields).
export function compileOwnership(rules, state) {
  const protectedPaths = new Map();
  const lines = String(rules || '').split(/\r?\n/u);
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^ {2}([^#\s][^:：]*):\s*$/u);
    if (!match) continue;
    sections.push({ declared: match[1], start: i + 1, end: lines.length });
    if (sections.length > 1) sections.at(-2).end = i;
  }
  for (const section of sections) {
    const expanded = expandPath(section.declared);
    if (!expanded.some(path => at(state, path) !== undefined)) continue;
    const sentences = lines.slice(section.start, section.end)
      .filter(line => /^\s*- /u.test(line)).flatMap(line => line.split(/[。；;]/u));
    for (const sentence of sentences) {
      if (!/(?:前端|脚本)/u.test(sentence) || /前端不|不由前端/u.test(sentence)) continue;
      if (!/禁止.*(?:修改|写入|清空)|托管|由前端.*自动(?:计算|合成)|重置由前端处理|交由前端掌控/u.test(sentence)) continue;
      const candidates = new Map();
      for (const path of expanded) {
        const value = at(state, path);
        if (value === undefined) continue;
        candidates.set(pointer(path), path);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const key of Object.keys(value)) candidates.set(pointer([...path, key]), [...path, key]);
        } else {
          const parent = at(state, path.slice(0, -1));
          if (parent && typeof parent === 'object') for (const key of Object.keys(parent)) candidates.set(pointer([...path.slice(0, -1), key]), [...path.slice(0, -1), key]);
        }
      }
      let matched = false;
      for (const [key, path] of candidates) {
        if (mentions(sentence.replace(/【[^】]+】/gu, ' '), path.at(-1))) {
          protectedPaths.set(key, { path: key, rule: sentence.trim() }); matched = true;
        }
      }
      // A check applying to every declared leaf can omit the leaf names.
      if (!matched && /【(?:完全)?禁止修改】\s*由前端|此变量.*交由前端/u.test(sentence)) {
        for (const path of expanded) protectedPaths.set(pointer(path), { path: pointer(path), rule: sentence.trim() });
      }
    }
  }
  return {
    protected: [...protectedPaths.values()],
    underscoreReadonly: /field names starts with ['"`]?_.*readonly|_.*只读/u.test(String(rules)),
  };
}
function overlaps(a, b) { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
function insertLeaves(path, value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) return Object.entries(value).flatMap(([key, v]) => insertLeaves([...path, key], v));
  return [pointer(path)];
}
export function checkOwnership(operations, policy) {
  const errors = [];
  for (const [index, op] of operations.entries()) {
    const destination = op.op === 'move' ? (op.to ?? op.path) : op.path;
    const parts = pointerParts(destination);
    const paths = op.op === 'insert' ? insertLeaves(parts, op.value) : [destination];
    if (op.op === 'move') paths.push(op.from);
    for (const path of paths) {
      if (pointerParts(path).some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) errors.push({ index, path, code: 'unsafe_path' });
      if (policy.underscoreReadonly && pointerParts(path).some(part => part.startsWith('_'))) errors.push({ index, path, code: 'readonly_path' });
      for (const owned of policy.protected) if (overlaps(path, owned.path)) errors.push({ index, path, code: 'frontend_owned', ownerPath: owned.path, rule: owned.rule });
    }
  }
  return errors;
}

export function changedPaths(before, after, base = []) {
  if (equal(before, after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return [pointer(base)];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => changedPaths(before[key], after[key], [...base, key]));
}
