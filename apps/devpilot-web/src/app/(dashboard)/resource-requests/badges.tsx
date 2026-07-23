/** 资源申请域 - 展示判定与徽章文案（纯函数 + JSX 徽章）。 */

import type { ResourceRequest, ResourceProvisioningRun, ProvisioningResult } from './types';
import { statusLabelKeys } from './constants';
import { StatusTag } from '@/components/ui';

/** provisioning.status → 展示文案。 */
const provisioningStatusLabels: Record<string, string> = {
  completed: '处理完成',
  planned: '已生成计划',
  blocked: '处理阻断',
  queued: '已入队',
};

/** run.status → 展示文案。 */
const runStatusLabels: Record<string, string> = {
  queued: '已入队',
  running: '运行中',
  planned: '已计划',
  blocked: '已阻断',
  completed: '已完成',
  failed: '失败',
};

/** status → resourceRequests 命名空间下的 i18n key（供调用方解析文案）。 */
export function getStatusLabelKey(status: ResourceRequest['status']): string {
  return statusLabelKeys[status];
}

/** 已解析文案的状态徽章；label 由调用方通过 t(getStatusLabelKey(status)) 提供。 */
export function getStatusBadge(status: ResourceRequest['status'], label: string) {
  return <StatusTag status={status} label={label} />;
}

// TODO(ui-overhaul): StatusTag has no title prop; provisioning reason/boundary no longer surfaces on hover — add title passthrough to StatusTag in a follow-up.
export function getProvisioningBadge(provisioning?: ProvisioningResult) {
  if (!provisioning?.status) {
    return null;
  }

  const label = provisioningStatusLabels[provisioning.status] || provisioning.status;
  return (
    <StatusTag
      status={provisioning.status}
      label={provisioning.mode ? `${provisioning.mode} · ${label}` : label}
      className="max-w-full"
    />
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
  const value = status || 'unknown';
  return <StatusTag status={value} label={runStatusLabels[value] || value} />;
}

export function getRunTriggerLabel(trigger?: string) {
  const labels: Record<string, string> = {
    approval: '审批触发',
    manual_retry: '手动重试',
    auto_retry: '自动补偿',
  };
  return trigger ? labels[trigger] || trigger : '-';
}

/** 日期时间格式化（带秒，统一走共享 util；原为 locale 默认格式）。 */
export { formatDateTime } from '@/lib/format-date';

export function summarizeRecord(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) {
    return '-';
  }
  return Object.keys(value).slice(0, 6).join(', ');
}

export function shortId(value?: string) {
  return value ? value.slice(0, 8) : '-';
}
