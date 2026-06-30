/** 日志域常量 - 来源/级别/状态标签与样式。 */

import type { TargetType } from './types';

export const sourceLabels: Record<string, string> = {
  manual: '手动',
  server_executor: 'Server executor',
  docker: 'Docker',
  nginx: 'Nginx/OpenResty',
  sls: 'SLS',
  deployment: '部署',
  backup: '备份',
  alert: '告警',
};

export const levelClasses: Record<string, string> = {
  trace: 'bg-gray-100 text-gray-700',
  debug: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  fatal: 'bg-red-100 text-red-700',
};

export const runStatusClasses: Record<string, string> = {
  queued: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  running: 'bg-blue-100 text-blue-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-700',
};

export const streamReconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];
export const streamSessionMaxMs = 300000;
