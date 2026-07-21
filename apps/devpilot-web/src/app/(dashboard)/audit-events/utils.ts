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
    event.targetId ||
    '-'
  );
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
