/** 日志域常量 - 来源/级别/状态标签与样式。 */

import type { TargetType } from './types';

export const targetTypeOptions: Array<{ value: TargetType; label: string }> = [
  { value: 'service', label: '应用服务' },
  { value: 'server', label: '服务器' },
  { value: 'site', label: '站点' },
  { value: 'resource', label: '资源' },
  { value: 'backup', label: '备份' },
  { value: 'deployment', label: '部署' },
  { value: 'alert', label: '告警' },
  { value: 'manual', label: '项目' },
];

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

export const streamReconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];
export const streamSessionMaxMs = 300000;
