/**
 * 操作审批域常量
 *
 * 单一职责：仅放标签映射与状态选项。
 */

export const categoryLabels: Record<string, string> = {
  resource_action: '资源动作',
  service_operation: '服务操作',
  deployment: '部署',
  site_sync: '站点同步',
};

export const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  cancelled: '已取消',
};

export const riskLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export const STATUS_OPTIONS = [
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'all', label: '全部' },
];
