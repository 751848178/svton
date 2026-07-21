/** 执行治理域工具 - Job 状态判定、格式化、基础读取原语（纯函数）。 */

import type { ServerExecutionJob } from './types';

export function canRetry(job: ServerExecutionJob) {
  return ['failed', 'blocked', 'cancelled'].includes(job.status);
}

export function canCancel(job: ServerExecutionJob) {
  return ['queued', 'blocked', 'running'].includes(job.status) && !job.cancelRequestedAt;
}

export function isStaleRunning(job: ServerExecutionJob) {
  if (job.status !== 'running' || !job.lockExpiresAt) return false;
  return new Date(job.lockExpiresAt).getTime() <= Date.now();
}

export function readBlockedBy(metadata?: Record<string, unknown> | null) {
  const operation = metadata?.blockedByOperationKey;
  return typeof operation === 'string' && operation ? `阻塞来源：${operation}` : '-';
}

export function formatCleanupReason(reason: string) {
  const labels: Record<string, string> = {
    cancel: '取消',
    timeout: '超时',
    stale_recovery: '陈旧恢复',
  };
  return labels[reason] || reason;
}

export function formatAgentSource(source: string) {
  const labels: Record<string, string> = {
    server_services: '服务',
    server_tags: '标签',
  };
  return labels[source] || source;
}

export function formatAgentDispatchMode(mode: string) {
  const labels: Record<string, string> = {
    agent_dispatch: '已投递',
    agent_dispatch_failed: '投递失败',
    blocked_live_execution: 'live 阻塞',
    dry_run: 'dry-run 计划',
    cancelled: '已取消',
  };
  return labels[mode] || mode;
}

export function formatAgentRuntimeState(state: string) {
  const labels: Record<string, string> = {
    online: '在线',
    stale: '陈旧',
    unknown: '未知',
  };
  return labels[state] || state;
}

/** JSON 详情展示:空值返回 '-',序列化失败退化为字符串。 */
export function formatJsonDetail(value: unknown) {
  if (value === undefined || value === null) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatEnabled(value?: boolean) {
  if (value === undefined) return '-';
  return value ? '开启' : '关闭';
}

export function formatConfigured(value?: boolean) {
  if (value === undefined) return '-';
  return value ? '已配置' : '未配置';
}

export function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/** 日期时间格式化（带秒，统一走共享 util）。 */
export { formatDateTime as formatDate } from '@/lib/format-date';
