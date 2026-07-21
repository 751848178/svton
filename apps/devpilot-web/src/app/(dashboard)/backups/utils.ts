/**
 * 备份域工具函数
 *
 * 单一职责：纯函数（无状态、无副作用）。
 */

import dayjs from 'dayjs';

import { providerLabels, kindLabels } from './constants';
import type { ManagedResource, BackupPlan } from './types';

/** 判断资源是否可备份（Docker mysql/redis/database 或 阿里云 RDS 数据库）。 */
export function isBackupableResource(resource: ManagedResource): boolean {
  if (resource.sourceType === 'server' && resource.provider === 'docker') {
    return ['mysql', 'redis', 'database'].includes(resource.kind);
  }
  return (
    resource.sourceType === 'cloud' &&
    resource.provider === 'aliyun-rds' &&
    resource.kind === 'database'
  );
}

/** 判断备份计划的运行是否可加入服务器队列（资源为服务器类型）。 */
export function canQueueBackupRun(plan: BackupPlan): boolean {
  return plan.resource?.sourceType === 'server';
}

/** 判断备份运行记录是否可发起恢复（仅 completed/success 终态）。 */
export function canRestoreBackupRun(status: string): boolean {
  return status === 'completed' || status === 'success';
}

/** 格式化资源展示名。 */
export function formatResource(resource?: ManagedResource | null): string {
  if (!resource) return '未知资源';
  const provider = providerLabels[resource.provider] || resource.provider;
  const kind = kindLabels[resource.kind] || resource.kind;
  return `${resource.name} · ${provider}/${kind}`;
}

/** 日期格式化（月/日 时:分，自定义格式，保留 MM-DD HH:mm）。 */
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('MM-DD HH:mm') : value;
}
