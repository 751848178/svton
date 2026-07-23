/**
 * 站点标签解析工具 - 把返回 i18n 键的 label helper 在调用方统一解析为文案。
 *
 * getStatusLabel/getRunModeLabel 现在返回 `sites` 命名空间下的 i18n 键（或空串）。
 * 本文件集中处理「键为空时回退原值」的约定，避免每个调用点重复写 fallback。
 * 单一职责：键 → 文案解析。无状态、无业务规则。
 */

import { getStatusLabel, getRunModeLabel } from './utils-format';

type Translate = (key: string) => string;

/** 用 translator 解析 status 标签；未知 status 回退原值。 */
export function resolveStatusLabel(t: Translate, status: string): string {
  const key = getStatusLabel(status);
  return key ? t(key) : status;
}

/** 用 translator 解析 run-mode 标签；未知 mode 回退原值。 */
export function resolveRunModeLabel(t: Translate, mode: string): string {
  const key = getRunModeLabel(mode);
  return key ? t(key) : mode;
}
