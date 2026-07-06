/**
 * 操作审批域工具函数
 *
 * 单一职责：纯函数（目标名推导、metadata 读取、日期格式化）。
 */

import type { OperationApproval } from './types';

/** 从审批关联实体推导展示目标名。 */
export function formatTarget(approval: OperationApproval): string {
  return (
    approval.applicationService?.name ||
    approval.managedResource?.name ||
    approval.site?.name ||
    approval.server?.name ||
    approval.application?.name ||
    approval.project?.name ||
    approval.targetId ||
    '-'
  );
}

/** 去除 action 前缀（如 resource.start → start）。 */
export function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function readMetadataBoolean(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  return metadata?.[key] === true;
}

export function readMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 日期时间格式化（带秒，统一走共享 util）。 */
export { formatDateTime } from '@/lib/format-date';
