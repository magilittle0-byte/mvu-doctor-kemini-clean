// Database spv8.4 grouped-fill boundary adapted from sheet keys to MVU paths.
// This plans structural coverage only; it does not interpret story semantics.
import { at, expandPath, pointer, pointerParts } from './core.mjs';

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
  // A container can contain many independent entries/checks. Keep its existing
  // atomic ownership range, but give it a whole request rather than counting it
  // as one scalar beside seven unrelated containers. Both snapshots matter:
  // a currently malformed scalar must not hide a previously structured range.
  const containers = [], scalars = [];
  for (const path of paths) {
    const parts = pointerParts(path);
    const structured = [at(current, parts), at(previous, parts)].some(value => value !== null && typeof value === 'object');
    (structured ? containers : scalars).push(path);
  }
  const groups = containers.map(path => ({ id: '', paths: [path] }));
  for (let i = 0; i < scalars.length; i += width) groups.push({ id: '', paths: scalars.slice(i, i + width) });
  groups.forEach((group, index) => { group.id = `group-${index + 1}`; });
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

// prepareAIInput_ACU places each target sheet's complete trigger contract
// beside its current rows. Keep MVU declarations verbatim instead of
// interpreting nested checks or reserializing their multi-line types.
export function groupRuleMaterial(rules, current, group) {
  const lines = String(rules || '').split(/\r?\n/u), sections = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^ {2}([^#\s][^:：]*):\s*$/u);
    if (!match) continue;
    if (sections.length) sections.at(-1).end = index;
    sections.push({ start: index, end: lines.length, declared: match[1] });
  }
  const focus = sections.filter(section => expandPath(section.declared).some(parts => {
    const path = pointer(parts);
    return group.paths.some(parent => within(path, parent) || within(parent, path));
  }));
  // The complete original rules are always present in the base messages.
  // An unfamiliar declaration format is not evidence that a field has no rules.
  if (!focus.length) return '';
  return '\n\n【本组字段规则原文与当前值】\n'
    + focus.map(section => lines.slice(section.start, section.end).join('\n')).join('\n\n')
    + '\n\n【本组写前MVU值】\n'
    + group.paths.map(path => {
      const value = at(current, pointerParts(path));
      return path + ': ' + (value === undefined ? '字段不存在' : JSON.stringify(value));
    }).join('\n')
    + '\n\n按这些原始字段声明逐项核对；嵌套字段的条件与父级条件均保留。依原有任务返回本组必要差额，未触发的空字段不因背景有同名记录而变成漏填。';
}

export function groupInstruction(group, index, total) {
  return `【本轮分组核对 ${index + 1}/${total}】
本次只核对以下路径及其全部后代，其他字段由同一轮的其他组核对：
${group.paths.map(path => `- ${path}`).join('\n')}
对每项先在Analysis中引用本卡check里决定字段所属范围、创建或更新时机的原句，再逐个判断这些条件是否成立，给出对应的用户明确输入或已接受正文依据。这个判断先于寻找同名记录或补齐空值：正文、面板或数据库将某事物称为同一类别，不等于它属于该完整路径，也不能替代原check的前提。条件成立后再比较当前值与本轮结束应有值；条件未成立而已有错写时纠正错写，不能沿用错误去补全整项。区分明确创建登记、已发生变化和仍未完成的行动；本字段原check要求在创建时设定的，直接登记用户明确提交的对应值，不要求正文重复；该登记许可不扩展到其它字段。必要差额才给补丁；无差额也说明为什么不需要维护。
同一字段声明的type、format和允许值也要核对，不能只核对check触发事件或只看存储是否已有内容；不要把占位文本当作已满足具体格式。
仍可读取全部背景、规则和变量作为事实依据。只写本组范围；move的来源和目标都须在本组。跨组归属变化仅增删各自负责的条目，所有组将统一提交，不重放原增量。不直接改只读字段，也不为了派生总值重复加入已登记的加成。返回唯一完整UpdateVariable和JSONPatch。`;
}
