/**
 * 项目详情域 - 标签/状态工具
 *
 * 单一职责：状态文案、状态样式、资源/Webhook/部署标签（纯函数）。
 */

import type { GeneratedResourceResolution } from '../types/operations';
import { toProjectConfigRecord } from '@/lib/project-display';
import {
  serverRoleOptions,
  resourceKindLabels,
  resourceProviderLabels,
  API_BASE_URL,
} from '../constants';

export function getServerRoleLabel(role?: string | null): string {
  return serverRoleOptions.find((o) => o.value === role)?.label || '混合用途';
}

export function getServerStatusLabel(status: string): string {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  return '未知';
}

export function getServerStatusClassName(status: string): string {
  if (status === 'online') return 'text-green-700';
  if (status === 'offline') return 'text-red-700';
  return 'text-muted-foreground';
}

export function getDeploymentStatusLabel(status: string): string {
  if (status === 'queued') return '排队中';
  if (status === 'completed') return '已完成';
  if (status === 'blocked') return '已阻塞';
  if (status === 'failed') return '失败';
  if (status === 'running') return '运行中';
  return status;
}

export function getDeploymentStatusClass(status: string): string {
  if (status === 'queued') return 'bg-indigo-100 text-indigo-700';
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}

export function getDeploymentModeLabel(mode: string): string {
  if (mode === 'rollback') return '回滚';
  if (mode === 'smoke_check') return 'Smoke';
  return '部署';
}

export function getResourceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: '启用',
    inactive: '停用',
    running: '运行中',
    stopped: '已停止',
    online: '在线',
    offline: '离线',
    released: '已释放',
    expired: '已过期',
    revoked: '已回收',
    draft: '草稿',
    synced: '已同步',
    error: '异常',
    unknown: '未知',
  };
  return map[status] || status;
}

export function getResourceStatusClass(status: string): string {
  if (['active', 'running', 'online', 'synced'].includes(status))
    return 'bg-green-100 text-green-700';
  if (['stopped', 'inactive', 'draft', 'unknown'].includes(status))
    return 'bg-yellow-100 text-yellow-700';
  if (['error', 'offline', 'expired', 'revoked'].includes(status)) return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}

export function getOperationApprovalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消',
  };
  return map[status] || status;
}

export function formatGeneratedResourceType(type: string): string {
  return resourceKindLabels[type] || resourceProviderLabels[type] || type;
}

export function formatGeneratedResourceDetail(resource: GeneratedResourceResolution): string {
  if (resource.mode === 'skipped') return '生成结果只保留模板占位变量';
  return resource.name || resource.resourceName || resource.sourceId || '已写入生成配置';
}

export function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : '';
}

export function readGeneratedResourceResolutions(config: unknown): GeneratedResourceResolution[] {
  const record = toProjectConfigRecord(config);
  const resolvedResources = record.resolvedResources;
  if (!Array.isArray(resolvedResources)) return [];
  return resolvedResources
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    )
    .map((item) => ({
      type: readNonEmptyString(item.type) || 'resource',
      mode: readNonEmptyString(item.mode) || 'manual',
      sourceId: readNonEmptyString(item.sourceId) || null,
      name: readNonEmptyString(item.name) || null,
      resourceName: readNonEmptyString(item.resourceName) || null,
    }));
}

export function toApiDownloadEndpoint(downloadUrl: string): string {
  const path = downloadUrl.startsWith('http') ? new URL(downloadUrl).pathname : downloadUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath.startsWith('/api/') ? normalizedPath.slice(4) : normalizedPath;
}

export function readDownloadFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return '';
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1]);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || '';
}

export function buildWebhookEndpoint(urlToken: string): string {
  return `${API_BASE_URL}/api/webhooks/git/${urlToken}`;
}

export function getWebhookDeploymentModeLabel(mode: string): string {
  if (mode === 'preview') return 'PR Preview';
  if (mode === 'queue') return '加入 dry-run 队列';
  if (mode === 'live_request') return '申请 Live 部署';
  return '生成 dry-run 计划';
}

export function getWebhookEventTypesLabel(eventTypes: unknown): string {
  const values = Array.isArray(eventTypes)
    ? eventTypes.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  const hasPush = values.includes('push');
  const hasPreview = values.includes('pull_request') || values.includes('merge_request');
  if (hasPush && hasPreview) return 'Push + PR Preview';
  if (hasPreview) return 'PR Preview';
  if (hasPush) return 'Push';
  return values.length > 0 ? values.join(', ') : '事件未配置';
}

export function getWebhookDeliveryStatusLabel(status: string): string {
  const map: Record<string, string> = {
    accepted: '已接受',
    ignored: '已忽略',
    failed: '失败',
    received: '已接收',
  };
  return map[status] || status;
}

export function getWebhookDeliveryStatusClass(status: string): string {
  if (status === 'accepted') return 'bg-green-100 text-green-700';
  if (status === 'ignored') return 'bg-yellow-100 text-yellow-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}
