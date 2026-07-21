/**
 * 项目详情域常量
 *
 * 单一职责：仅放标签映射、选项常量、API 基址。
 */

export const deploymentTargetLabels: Record<string, string> = {
  'docker-compose': 'Docker Compose',
  server: '服务器脚本',
  kubernetes: 'Kubernetes',
  'external-ci': '外部 CI',
};

export const resourceKindLabels: Record<string, string> = {
  docker_container: 'Docker 容器',
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
  log_service: '日志服务',
  object_storage: '对象存储',
};

export const resourceProviderLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
};

export const generatedResourceModeLabels: Record<string, string> = {
  manual: '手动填写',
  credential: '已有凭证',
  instance: '资源实例',
  pool: '资源池分配',
  skipped: '跳过',
};

export const serverRoleOptions = [
  { value: 'runtime', label: '运行服务' },
  { value: 'deploy', label: '部署执行' },
  { value: 'database', label: '数据库' },
  { value: 'edge', label: '边缘入口' },
  { value: 'mixed', label: '混合用途' },
] as const;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3121';
