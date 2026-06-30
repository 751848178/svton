/**
 * 审计事件域常量
 *
 * 单一职责：仅放标签与筛选选项。
 */

export const categoryLabels: Record<string, string> = {
  deployment: '部署',
  resource_action: '资源动作',
  service_operation: '服务操作',
  backup: '备份',
  alert: '告警',
  log: '日志',
};

export const statusLabels: Record<string, string> = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
};

export const riskLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export interface FilterOption {
  value: string;
  label: string;
}

export const CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'all', label: '全部分类' },
  { value: 'deployment', label: '部署' },
  { value: 'resource_action', label: '资源动作' },
  { value: 'service_operation', label: '服务操作' },
  { value: 'backup', label: '备份' },
  { value: 'alert', label: '告警' },
  { value: 'log', label: '日志' },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: '全部状态' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'blocked', label: '已阻塞' },
  { value: 'running', label: '运行中' },
];

export const RISK_OPTIONS: FilterOption[] = [
  { value: 'all', label: '全部风险' },
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
];
