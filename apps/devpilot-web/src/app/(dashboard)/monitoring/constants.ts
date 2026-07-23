/** 监控域常量 - 标签与样式映射。 */

export const categoryLabels: Record<string, string> = {
  service: '服务',
  server: '服务器',
  site: '站点',
  resource: '资源',
  backup: '备份',
  deployment: '部署',
  cloud_sync: '云同步',
  log: '日志',
};

/** 资源指标仪表盘行 kind 标签（开放枚举，未知回退人性化由 humanizeKey 处理）。 */
export const resourceKindLabels: Record<string, string> = {
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
};

/** 资源指标来源（metricSource）标签。 */
export const metricSourceLabels: Record<string, string> = {
  cpu: 'CPU',
  memory: '内存',
  disk: '磁盘',
  network: '网络',
};

export const metricLabels: Record<string, string> = {
  service_status: '服务状态',
  service_slo_breach: '服务 SLO 违约',
  service_error_budget: '服务错误预算',
  service_error_budget_exhaustion: '错误预算耗尽预测',
  server_status: '服务器状态',
  site_status: '站点状态',
  certificate_expiry: '证书过期',
  certificate_asset_change: '证书变化',
  tls_renewal_failure: 'TLS 续期失败',
  site_smoke_check_failure: 'Smoke 检查失败',
  resource_status: '资源状态',
  resource_metric_threshold: '资源指标阈值',
  backup_status: '备份状态',
  deployment_status: '部署状态',
  deployment_smoke_check_failure: '部署 Smoke 失败',
  cloud_provider_sync_failure: '云同步失败',
  log_error_count: '日志错误数',
  log_warning_count: '日志警告数',
  log_fatal_count: '致命日志数',
};

export const cloudProviderLabels: Record<string, string> = {
  all: '全部 Provider',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
};

export const resourceMetricLabels: Record<string, string> = {
  cpuPercent: 'CPU',
  memoryPercent: '内存',
  memoryUsageBytes: '内存用量',
  pids: 'PIDs',
};

export const resourceMetricAggregationLabels: Record<string, string> = {
  latest: '当前值',
  average: '平均值',
  max: '峰值',
};

export const resourceMetricOperatorLabels: Record<string, string> = {
  gte: '>=',
  gt: '>',
  lte: '<=',
  lt: '<',
};

export const notificationChannelTypeLabels: Record<string, string> = {
  webhook: '通用 Webhook',
  feishu: '飞书机器人',
  dingtalk: '钉钉机器人',
  wecom: '企业微信机器人',
  email: '邮件',
};

export const notificationChannelTargetPlaceholders: Record<string, string> = {
  webhook: 'https://example.com/hooks/alerts',
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
  dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=...',
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
  email: 'ops@example.com, sre@example.com',
};

export const severityLabels: Record<string, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

export const statusLabels: Record<string, string> = {
  ok: '正常',
  firing: '触发',
  resolved: '已恢复',
  insufficient_data: '数据不足',
  error: '错误',
  acknowledged: '已确认',
  suppressed: '已静默',
  active: '启用',
  paused: '暂停',
  archived: '归档',
  expired: '已过期',
  planned: '计划',
  sent: '已发送',
  failed: '失败',
  skipped: '跳过',
  stale: '样本过期',
  no_data: '暂无数据',
};
