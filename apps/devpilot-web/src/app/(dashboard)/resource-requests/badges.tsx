/** 资源申请域 - 展示判定与徽章文案（纯函数 + JSX 徽章）。 */

import type { ResourceRequest, ResourceProvisioningRun, ProvisioningResult } from './types';
import { statusLabels } from './constants';

export function getStatusBadge(status: ResourceRequest['status']) {
  const classes: Record<ResourceRequest['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    canceled: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${classes[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export function getProvisioningBadge(provisioning?: ProvisioningResult) {
  if (!provisioning?.status) {
    return null;
  }

  const classes: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    planned: 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    queued: 'bg-purple-100 text-purple-700',
  };
  const label =
    provisioning.status === 'completed'
      ? '处理完成'
      : provisioning.status === 'planned'
        ? '已生成计划'
        : provisioning.status === 'blocked'
          ? '处理阻断'
          : provisioning.status === 'queued'
            ? '已入队'
            : provisioning.status;

  return (
    <div
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs ${
        classes[provisioning.status] || 'bg-muted text-muted-foreground'
      }`}
      title={provisioning.reason || provisioning.boundary || provisioning.mode}
    >
      <span className="truncate">
        {provisioning.mode ? `${provisioning.mode} · ${label}` : label}
      </span>
    </div>
  );
}

export function canRetryProvisioning(provisioning?: ProvisioningResult) {
  return provisioning?.status === 'blocked' || provisioning?.status === 'planned';
}

export function canViewProvisioningRuns(request: ResourceRequest) {
  return Boolean(
    request.result?.provisioning?.provisioningRunId ||
    request.resourceType?.provisioningMode === 'api' ||
    request.resourceType?.provisioningMode === 'webhook',
  );
}

export function canReplayProvisioningRun(request: ResourceRequest, run: ResourceProvisioningRun) {
  const currentRunId = request.result?.provisioning?.provisioningRunId;
  return (
    request.status === 'approved' &&
    currentRunId === run.id &&
    (run.mode === 'api' || run.mode === 'webhook') &&
    ['planned', 'blocked', 'failed'].includes(run.status || '')
  );
}

export function canReconcileProviderProvisioningRun(
  request: ResourceRequest,
  run: ResourceProvisioningRun,
) {
  const currentRunId = request.result?.provisioning?.provisioningRunId;
  return request.status === 'approved' && currentRunId === run.id && run.mode === 'provider';
}

export function getRunStatusBadge(status?: string) {
  const classes: Record<string, string> = {
    queued: 'bg-purple-100 text-purple-700',
    running: 'bg-blue-100 text-blue-700',
    planned: 'bg-sky-100 text-sky-700',
    blocked: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    planned: '已计划',
    blocked: '已阻断',
    completed: '已完成',
    failed: '失败',
  };
  const value = status || 'unknown';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${classes[value] || 'bg-muted text-muted-foreground'}`}
    >
      {labels[value] || value}
    </span>
  );
}

export function getRunTriggerLabel(trigger?: string) {
  const labels: Record<string, string> = {
    approval: '审批触发',
    manual_retry: '手动重试',
    auto_retry: '自动补偿',
  };
  return trigger ? labels[trigger] || trigger : '-';
}

export function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

export function summarizeRecord(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) {
    return '-';
  }
  return Object.keys(value).slice(0, 6).join(', ');
}

export function shortId(value?: string) {
  return value ? value.slice(0, 8) : '-';
}
