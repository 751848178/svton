/**
 * 环境变量 staged diff 计算
 *
 * 单一职责：对比「已落库 vars」与「暂存 draft」，产出新增/修改/删除三类变更，
 * 供 Review 弹窗渲染 diff、顶栏统计「N 项待部署」。
 *
 * 纯函数，无业务状态、无 IO。
 */

export type EnvVarChangeKind = 'added' | 'modified' | 'removed';

export interface EnvVarChange {
  key: string;
  kind: EnvVarChangeKind;
  /** 旧值（modified/removed 时有意义；added 时为 undefined）。 */
  oldValue?: string;
  /** 新值（added/modified 时有意义；removed 时为 undefined）。 */
  newValue?: string;
}

export interface EnvVarDiff {
  changes: EnvVarChange[];
  added: EnvVarChange[];
  modified: EnvVarChange[];
  removed: EnvVarChange[];
  /** 总变更条数（added + modified + removed）。 */
  total: number;
}

/**
 * 计算 base → draft 的环境变量 diff。
 *
 * 语义：
 *   - added：draft 中存在、base 中不存在。
 *   - removed：base 中存在、draft 中不存在。
 *   - modified：两侧都存在且值不同。
 *
 * 排序：added → modified → removed，键名字典序，保证 Review 视图稳定可读。
 */
export function diffEnvVars(
  base: Record<string, string>,
  draft: Record<string, string>,
): EnvVarDiff {
  const added: EnvVarChange[] = [];
  const modified: EnvVarChange[] = [];
  const removed: EnvVarChange[] = [];

  const baseKeys = new Set(Object.keys(base));
  const draftKeys = new Set(Object.keys(draft));

  for (const key of Array.from(draftKeys).sort()) {
    if (!baseKeys.has(key)) {
      added.push({ key, kind: 'added', newValue: draft[key] });
    } else if (base[key] !== draft[key]) {
      modified.push({ key, kind: 'modified', oldValue: base[key], newValue: draft[key] });
    }
  }

  for (const key of Array.from(baseKeys).sort()) {
    if (!draftKeys.has(key)) {
      removed.push({ key, kind: 'removed', oldValue: base[key] });
    }
  }

  const changes = [...added, ...modified, ...removed];
  return { changes, added, modified, removed, total: changes.length };
}
