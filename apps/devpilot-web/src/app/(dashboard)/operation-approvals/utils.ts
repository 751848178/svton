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

/** 已知动作键前缀，用于 humanizeAction 的兜底处理。 */
const ACTION_PREFIXES = ['resource.', 'application-service.', 'site.', 'deployment.'];

/**
 * 把机器动作键转为可读文本：先查 labelMap，命中失败则去前缀并将首字母大写。
 * labelMap 由调用方传入（沿用现有 categoryLabels/statusLabels 的纯映射风格）。
 */
export function humanizeAction(action: string, labelMap: Record<string, string> = {}): string {
  if (!action) return '';
  const mapped = labelMap[action];
  if (mapped) return mapped;
  const stripped = ACTION_PREFIXES.reduce(
    (acc, prefix) => (acc.startsWith(prefix) ? acc.slice(prefix.length) : acc),
    action,
  );
  if (!stripped) return action;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
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
