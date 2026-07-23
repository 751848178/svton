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

/**
 * 机器动作键（如 resource.start、deployment.run）的可读映射。
 * 命中失败时由 humanizeAction 兜底（去前缀 + 首字母大写）。
 */
export const actionLabels: Record<string, string> = {
  'deployment.run': '执行部署',
  'deployment.rollback': '回滚部署',
  'site.sync': '同步站点',
  'site.rollback': '回滚站点',
  'resource.start': '启动资源',
  'resource.stop': '停止资源',
  'resource.restart': '重启资源',
  'application-service.start': '启动服务',
  'application-service.stop': '停止服务',
  'application-service.restart': '重启服务',
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
