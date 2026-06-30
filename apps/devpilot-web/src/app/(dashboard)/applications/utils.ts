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

/** 日期格式化（月/日 时:分）。 */
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** 操作运行状态标签。 */
export function getOperationStatusLabel(status: string): string {
  return operationStatusLabels[status] || status;
}
