/**
 * 审计事件域工具函数
 *
 * 单一职责：纯函数（目标名推导、运行引用格式化、日期格式化）。
 */

import type { AuditEvent } from './types';

/** 从事件关联实体推导展示目标名。 */
export function formatTarget(event: AuditEvent): string {
  return (
    event.applicationService?.name ||
    event.managedResource?.name ||
    event.site?.name ||
    event.server?.name ||
    event.application?.name ||
    event.project?.name ||
    // 无具名关联实体时仅展示截断的 targetId（避免裸 UUID 占满单元格），保留完整值不可见；
    // 调用点 event-columns 中 targetId 同时作为 targetType 行的细节展示。
    (event.targetId ? `${event.targetId.slice(0, 8)}…` : '-')
  );
}

/** 已知动作键前缀（对齐后端真实埋点），用于 humanizeAction 的兜底处理。 */
const ACTION_PREFIXES = [
  'deployment.',
  'resource.',
  'application-service.',
  'site.',
  'backup.',
  'alert.',
  'log.',
];

/**
 * 把机器动作键转为可读文本：先查 labelMap，命中失败则去前缀并将首字母大写。
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

/**
 * 将审计事件 targetType/targetId 映射到站内路由。
 * 返回 null 表示无法映射（渲染纯文本）。
 * 映射口径以后端实际写入的 targetType 为准（apps/devpilot-api 审计埋点）。
 */
export function getTargetHref(event: AuditEvent): string | null {
  const id = event.targetId || undefined;
  switch (event.targetType) {
    case 'project':
      return id ? `/projects/${id}` : '/projects';
    case 'server':
      return id ? `/servers/${id}` : '/servers';
    case 'site':
      return '/sites';
    case 'application':
    case 'application_service':
      return '/applications';
    case 'domain':
    case 'domain_config_artifact':
      return '/domain';
    case 'backup_run':
    case 'backup_plan':
      return '/backups';
    case 'managed_resource':
      return '/resources';
    case 'resource_instance':
      return '/resource-instances';
    case 'resource_request':
      return '/resource-requests';
    case 'operation_approval':
      return '/operation-approvals';
    case 'cdn_config':
    case 'cdn_artifact':
      return '/cdn-configs';
    case 'proxy_config':
      return '/proxy-configs';
    case 'git_connection':
      return '/git';
    case 'preset':
      return '/presets';
    case 'alert_event':
      return '/monitoring';
    case 'secret_key':
      return '/keys';
    default:
      return null;
  }
}

/** 格式化事件关联的运行记录引用（部署/资源动作/备份等）。 */
export function formatRunRef(event: AuditEvent): string {
  if (event.deploymentRun) {
    return `${event.deploymentRun.trigger} · ${event.deploymentRun.status}`;
  }
  if (event.resourceActionRun) {
    return `${event.resourceActionRun.action} · ${event.resourceActionRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.applicationServiceOperationRun) {
    return `${event.applicationServiceOperationRun.action} · ${event.applicationServiceOperationRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.backupRun) {
    return `${event.backupRun.backupType} · ${event.backupRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.alertEvent) {
    return `${event.alertEvent.metric} · ${event.alertEvent.status}`;
  }
  if (event.logStream) {
    return `${event.logStream.name} · ${event.logStream.sourceType}`;
  }
  if (event.logEntry) {
    return `${event.logEntry.level} · ${event.logEntry.message.slice(0, 24)}`;
  }
  return '-';
}

/** 日期时间格式化（带秒，统一走共享 util）。 */
export { formatDateTime } from '@/lib/format-date';
