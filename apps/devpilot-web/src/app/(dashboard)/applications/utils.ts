/**
 * 应用服务域工具函数
 *
 * 单一职责：对象压缩、日期格式化、标签解析（纯函数）。
 */

import { kindLabelKeys, operationLabelKeys, operationStatusLabelKeys } from './constants';
import type { ServiceAction } from './types';

/** next-intl useTranslations 返回值的极小子集（避免耦合具体类型）。 */
export type Translator = (key: string) => string;

/** 去除空字符串字段，返回压缩后的对象。 */
export function compactObject(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value.trim().length > 0));
}

/** 日期时间格式化（不带秒，统一走共享 util）。 */
export { formatDateTimeMinute as formatDate } from '@/lib/format-date';

/** service.kind → 展示文案（未知 kind 原样返回）。 */
export function getKindLabel(t: Translator, kind: string): string {
  const key = kindLabelKeys[kind];
  return key ? t(key) : kind;
}

/** ServiceAction → 展示文案。 */
export function getOperationLabel(t: Translator, action: ServiceAction): string {
  return t(operationLabelKeys[action]);
}

/** operation run status → 展示文案（未知 status 原样返回）。 */
export function getOperationStatusLabel(t: Translator, status: string): string {
  const key = operationStatusLabelKeys[status];
  return key ? t(key) : status;
}

/** 百分比格式化。 */
export function formatPercent(value?: number | null): string {
  return value === null || value === undefined ? '-' : `${value.toFixed(2)}%`;
}
