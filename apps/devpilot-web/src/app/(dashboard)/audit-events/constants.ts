/**
 * 审计事件域常量
 *
 * 单一职责：仅放标签与筛选选项。
 *
 * 动作键口径以后端实际写入为准（apps/devpilot-api 审计埋点）：
 * - 部署：deployment.run / deployment.rollback / deployment.queue（category 'deployment'）
 * - 资源动作：resource.<key>，如 resource.start/stop/restart/sync_docker_inventory
 *   （category 'resource_action'，见 resource-control-action-audit.utils.ts）
 * - 服务操作：application-service.start/stop/restart（category 'service_operation'，
 *   见 application.service.ts）
 * - 站点：site.sync / site.diagnostics / site.smoke_check / site.rollback 等
 * - 备份：backup.run / backup.restore / backup.plan.create/update（category 'backup'）
 * - 告警：alert.evaluate / alert.escalate / alert.notification.retry（category 'alert'）
 * - 日志：log.append / log.collect / log.stream.tail（category 'log'）
 */

export const categoryLabels: Record<string, string> = {
  deployment: '部署',
  resource_action: '资源动作',
  service_operation: '服务操作',
  backup: '备份',
  alert: '告警',
  log: '日志',
};

/**
 * 机器动作键（对齐后端真实埋点，如 deployment.run、resource.start、application-service.start）
 * 的可读映射。命中失败时由 humanizeAction 兜底（去前缀 + 首字母大写）。
 */
export const actionLabels: Record<string, string> = {
  'deployment.run': '执行部署',
  'deployment.rollback': '回滚部署',
  'deployment.queue': '排队部署',
  'resource.start': '启动资源',
  'resource.stop': '停止资源',
  'resource.restart': '重启资源',
  'resource.sync_docker_inventory': '同步 Docker 清单',
  'resource.connection.probe': '连接探测',
  'resource.query.readonly': '只读查询',
  'application-service.start': '启动服务',
  'application-service.stop': '停止服务',
  'application-service.restart': '重启服务',
  'site.sync': '同步站点',
  'site.diagnostics': '站点诊断',
  'site.smoke_check': '站点冒烟测试',
  'site.tls_probe': 'TLS 探测',
  'site.tls_renew': 'TLS 续期',
  'site.rollback': '回滚站点',
  'backup.run': '运行备份',
  'backup.restore': '恢复备份',
  'backup.plan.create': '创建备份计划',
  'backup.plan.update': '更新备份计划',
  'alert.evaluate': '告警评估',
  'alert.escalate': '告警升级',
  'alert.notification.retry': '告警通知重试',
  'log.append': '追加日志',
  'log.collect': '采集日志',
  'log.stream.tail': '日志流',
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
