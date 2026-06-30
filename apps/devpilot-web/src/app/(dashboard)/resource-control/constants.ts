import type { CredentialProfile } from './types';
/** 资源管控域常量 - 标签与样式。 */

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

export const defaultCredentialProfiles: CredentialProfile[] = [
  {
    type: 'cloud_aliyun',
    name: '阿里云 AccessKey',
    providers: ['aliyun-rds', 'aliyun-sls'],
    authAdapterKey: 'aliyun-team-credential',
    requiredFields: ['accessKeyId', 'accessKeySecret'],
    optionalFields: ['securityToken', 'defaultRegion', 'accountId'],
    secretFields: ['accessKeySecret', 'securityToken'],
    futureTransport: 'aliyun_provider_sdk',
  },
  {
    type: 'cloud_tencent',
    name: '腾讯云 SecretId',
    providers: ['tencent-cos'],
    authAdapterKey: 'tencent-team-credential',
    requiredFields: ['secretId', 'secretKey'],
    optionalFields: ['defaultRegion', 'appId'],
    secretFields: ['secretKey'],
    futureTransport: 'tencent_cloud_sdk',
  },
  {
    type: 'db_mysql_readonly',
    name: 'MySQL/RDS 只读账号',
    providers: ['docker', 'aliyun-rds'],
    resourceKinds: ['mysql', 'database'],
    authAdapterKey: 'mysql-readonly-team-credential',
    requiredFields: ['host', 'port', 'username', 'password'],
    optionalFields: ['database', 'sslMode'],
    secretFields: ['password'],
    futureTransport: 'mysql_driver_adapter',
  },
  {
    type: 'db_redis_readonly',
    name: 'Redis 只读账号',
    providers: ['docker'],
    resourceKinds: ['redis'],
    authAdapterKey: 'redis-readonly-team-credential',
    requiredFields: ['host', 'port', 'password'],
    optionalFields: ['username', 'database'],
    secretFields: ['password'],
    futureTransport: 'redis_driver_adapter',
  },
];

export const statusClasses: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  collected: 'bg-green-100 text-green-700',
  stopped: 'bg-gray-100 text-gray-700',
  inactive: 'bg-gray-100 text-gray-700',
  unknown: 'bg-yellow-100 text-yellow-700',
  stale: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-yellow-100 text-yellow-700',
};
