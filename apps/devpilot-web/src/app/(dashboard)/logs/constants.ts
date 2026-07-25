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

/** 日志级别 → 中文标签（供 StatusTag label）。 */
export const levelLabels: Record<string, string> = {
  trace: '跟踪',
  debug: '调试',
  info: '信息',
  warning: '警告',
  error: '错误',
  fatal: '致命',
};

/** 日志流状态 → 中文标签（active/archived）。 */
export const streamStatusLabels: Record<string, string> = {
  active: '启用',
  archived: '已归档',
};

/** 采集/保留运行状态 → 中文标签（与部署运行状态枚举一致）。 */
export const runStatusLabels: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
  cancelled: '已取消',
};

export const streamReconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];
export const streamSessionMaxMs = 300000;
