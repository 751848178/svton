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

/** 日期时间格式化（月/日 时:分:秒，24h）。 */
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
