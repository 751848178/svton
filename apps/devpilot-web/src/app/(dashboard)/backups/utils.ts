/**
 * 备份域工具函数
 *
 * 单一职责：纯函数（无状态、无副作用）。
 */

import dayjs from 'dayjs';

import { providerLabels, kindLabels } from './constants';
import type { ManagedResource, BackupPlan } from './types';

/**
 * 把下划线/连字符分隔的标识符转为「首字母大写的词」。
 *
 * executorKey/adapterKey 是开放枚举（随资源类型增长），无法穷举映射；
 * 与 sites/utils-plan.ts 的 humanizeKey 同语义，做最稳健的人性化。
 */
export function humanizeKey(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) =>
      word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** 取 UUID/长串前 8 位作为短标识（仅用于展示，配合 # 前缀）。 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

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
