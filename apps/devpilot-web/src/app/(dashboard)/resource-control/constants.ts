/** 资源管控域常量 - 标签。 */

export const kindLabels: Record<string, string> = {
  docker_container: 'Docker 容器',
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
  log_service: '日志服务',
  object_storage: '对象存储',
};

export const providerLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
  all: '全部云资源',
};

