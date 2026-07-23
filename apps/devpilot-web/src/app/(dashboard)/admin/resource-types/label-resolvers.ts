/**
 * 资源类型展示标签解析
 *
 * 单一职责：将后端枚举值（审批/交付方式、分类）解析为本地化展示标签。
 * 纯函数、无业务状态。枚举 -> i18n key 映射与表单选项共享 constants.ts，
 * 消除漂移风险。
 */

import {
  APPROVAL_MODE_OPTIONS,
  PROVISIONING_MODE_OPTIONS,
} from './constants';

/** next-intl t 的子集（用 has 安全回退未知枚举值）。 */
export interface LabelTFunc {
  (key: string): string;
  has: (key: string) => boolean;
}

/** 由共享选项构建 值 -> i18n key 的查找表，避免重复硬编码。 */
const APPROVAL_MODE_KEYS: Record<string, string> = Object.fromEntries(
  APPROVAL_MODE_OPTIONS.map((option) => [option.value, option.labelKey]),
);
const PROVISIONING_MODE_KEYS: Record<string, string> = Object.fromEntries(
  PROVISIONING_MODE_OPTIONS.map((option) => [option.value, option.labelKey]),
);

/** 解析审批方式标签，未命中回退原始值。 */
export function resolveApprovalModeLabel(mode: string, t: LabelTFunc): string {
  const key = APPROVAL_MODE_KEYS[mode];
  return key && t.has(key) ? t(key) : mode;
}

/** 解析交付方式标签，未命中回退原始值。 */
export function resolveProvisioningModeLabel(mode: string, t: LabelTFunc): string {
  const key = PROVISIONING_MODE_KEYS[mode];
  return key && t.has(key) ? t(key) : mode;
}

/** 解析分类标签：命中 admin.category.* 翻译，否则回退原始值。 */
export function resolveCategoryLabel(category: string | undefined, t: LabelTFunc): string {
  if (!category) return '-';
  const key = `category.${category}`;
  return t.has(key) ? t(key) : category;
}
