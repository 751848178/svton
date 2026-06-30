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
    stale_recovery: 'stale recovery',
  };
  return labels[reason] || reason;
}

export function formatAgentSource(source: string) {
  const labels: Record<string, string> = {
    server_services: 'services',
    server_tags: 'tags',
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
    online: 'online',
    stale: 'stale',
    unknown: 'unknown',
  };
  return labels[state] || state;
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

export function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
