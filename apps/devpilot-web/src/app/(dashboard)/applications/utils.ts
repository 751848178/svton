/**
 * 应用服务域工具函数
 *
 * 单一职责：对象压缩、日期格式化、操作状态标签（纯函数）。
 */

import { operationStatusLabels } from './constants';

/** 去除空字符串字段，返回压缩后的对象。 */
export function compactObject(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value.trim().length > 0));
}

/** 日期时间格式化（不带秒，统一走共享 util）。 */
export { formatDateTimeMinute as formatDate } from '@/lib/format-date';

/** 操作运行状态标签。 */
export function getOperationStatusLabel(status: string): string {
  return operationStatusLabels[status] || status;
}

/** 百分比格式化。 */
export function formatPercent(value?: number | null): string {
  return value === null || value === undefined ? '-' : `${value.toFixed(2)}%`;
}
