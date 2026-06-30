/**
 * 应用服务域常量
 *
 * 单一职责：仅放标签映射与选项。
 */

import type { ServiceAction } from './types';

export const kindLabels: Record<string, string> = {
  'docker-compose': 'Docker Compose',
  container: '容器',
  static: '静态站点',
  external: '外部服务',
};

export const operationLabels: Record<ServiceAction, string> = {
  status: '状态',
  logs: '日志',
  restart: '重启',
  rollback: '回滚',
};

export const operationStatusLabels: Record<string, string> = {
  queued: '已入队',
  running: '运行中',
  completed: '完成',
  failed: '失败',
  blocked: '阻塞',
};

export const SERVICE_ACTIONS: ServiceAction[] = ['status', 'logs', 'restart', 'rollback'];

export const KIND_OPTIONS = [
  { value: 'docker-compose', label: 'Docker Compose' },
  { value: 'container', label: '容器' },
  { value: 'static', label: '静态站点' },
  { value: 'external', label: '外部服务' },
];
