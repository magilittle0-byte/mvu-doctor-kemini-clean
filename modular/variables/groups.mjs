// Database spv8.4 grouped-fill boundary adapted from sheet keys to MVU paths.
// This plans structural coverage only; it does not interpret story semantics.
import { expandPath, pointer, pointerParts } from './core.mjs';

const within = (path, parent) => parent === '' || path === parent || path.startsWith(`${parent}/`);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

export function planVariableGroups(rules, current, previous, maxPaths = 8, schemas = []) {
  const declared = [];
  const roots = new Set([...Object.keys(current || {}), ...Object.keys(previous || {}),
    ...schemas.flatMap(schema => schema?.type === 'object' && plain(schema.properties) ? Object.keys(schema.properties) : [])]);
  const lines = String(rules || '').split(/\r?\n/u);
  for (const line of lines) {
    const match = line.match(/^ {2}([^#\s][^:：]*):\s*$/u);
    // A check block may describe the update protocol rather than a field.
    if (!match || (!match[1].includes('.') && !roots.has(match[1]))) continue;
    declared.push(...expandPath(match[1]).map(pointer));
  }
  // Array indices can shift during insert/remove, so one group owns an array.
  function arrays(value, parts = []) {
    if (Array.isArray(value)) { declared.push(pointer(parts)); return; }
    if (plain(value)) for (const [key, child] of Object.entries(value)) arrays(child, [...parts, key]);
  }
  arrays(current); arrays(previous);
  const paths = [...new Set(declared)].sort((a, b) => pointerParts(a).length - pointerParts(b).length || (a < b ? -1 : a > b ? 1 : 0))
    .filter((path, index, all) => !all.slice(0, index).some(parent => within(path, parent)));
  function includeStored(a, b, parts) {
    const path = pointer(parts);
    if (paths.some(parent => within(path, parent))) return;
    const hasDeclaredChildren = paths.some(child => within(child, path));
    if (parts.length && hasDeclaredChildren && a !== undefined && !plain(a)) {
      // A wrong scalar parent must be repairable as a whole, not split into
      // child groups that cannot safely replace their shared container.
      for (let i = paths.length - 1; i >= 0; i--) if (within(paths[i], path)) paths.splice(i, 1);
      paths.push(path); return;
    }
    if (parts.length && !hasDeclaredChildren) { paths.push(path); return; }
    const keys = [...new Set([...Object.keys(plain(a) ? a : {}), ...Object.keys(plain(b) ? b : {})])];
    for (const key of keys) includeStored(a?.[key], b?.[key], [...parts, key]);
  }
  includeStored(current, previous, []);
  const width = Math.max(1, Math.floor(Number(maxPaths) || 8));
  const groups = [];
  for (let i = 0; i < paths.length; i += width) groups.push({ id: `group-${groups.length + 1}`, paths: paths.slice(i, i + width) });
  return groups;
}

function insertPaths(parts, value) {
  if (plain(value) && Object.keys(value).length) return Object.entries(value).flatMap(([key, child]) => insertPaths([...parts, key], child));
  return [pointer(parts)];
}
export function checkGroupScope(operations, group) {
  const errors = [];
  for (const [index, operation] of operations.entries()) {
    const destination = operation.op === 'move' ? (operation.to ?? operation.path) : operation.path;
    const paths = operation.op === 'insert' ? insertPaths(pointerParts(destination), operation.value) : [destination];
    if (operation.op === 'move') paths.push(operation.from);
    for (const path of paths) if (!group.paths.some(parent => within(path, parent))) errors.push({ index, path, code: 'outside_group' });
  }
  return errors;
}

export function groupInstruction(group, index, total) {
  return `【本轮分组核对 ${index + 1}/${total}】
本次只核对以下路径及其全部后代，其他字段由同一轮的其他组核对：
${group.paths.map(path => `- ${path}`).join('\n')}
对每项分别说明本卡check的触发条件、本轮正文是否触发及依据、当前值与本轮结束应有值；有差额才给补丁，没有差额也说明为什么不需要维护。不得预设存在错误或预设全部正确，依据上述原始材料自行判断。
仍可读取全部背景、规则和变量作为事实依据。只写本组范围；move的来源和目标都须在本组。跨组归属变化仅增删各自负责的条目，所有组将统一提交，不重放原增量。不直接改只读字段，也不为了派生总值重复加入已登记的加成。返回唯一完整UpdateVariable和JSONPatch。`;
}
