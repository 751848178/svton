/**
 * 站点同步计划描述工具 - 把 executorKey/adapterKey/mode 拼成可读的头部文案。
 *
 * executorKey/adapterKey 是开放枚举（随资源类型增长），无法穷举映射；
 * 这里做最稳健的人性化（分隔符转空格、首字母大写）。mode 走 i18n 键（已知）
 * 命中则翻译，未知回退人性化结果。
 *
 * 单一职责：计划字段 → 头部文案。无状态。
 */

import { getRunModeLabel } from './utils-format';

type Translate = (key: string) => string;

interface PlanLike {
  executorKey: string;
  adapterKey: string;
  mode: string;
}

/** 把下划线/连字符分隔的标识符转为「首字母大写的词」。 */
export function humanizeKey(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/**
 * 解析 mode：已知 mode 走 i18n；未知则回退人性化。
 */
export function describePlanMode(t: Translate, mode: string): string {
  const key = getRunModeLabel(mode);
  return key ? t(key) : humanizeKey(mode);
}

/** 拼接 executor · adapter · mode 的可读头部。 */
export function describePlanHeader(t: Translate, plan: PlanLike): string {
  return [humanizeKey(plan.executorKey), humanizeKey(plan.adapterKey), describePlanMode(t, plan.mode)]
    .filter(Boolean)
    .join(' · ');
}
