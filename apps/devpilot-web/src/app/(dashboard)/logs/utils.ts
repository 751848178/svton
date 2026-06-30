/** 日志域工具 - 目标类型格式化与来源推导。 */

import type { TargetType, ManagedResource } from './types';
import { sourceLabels } from './constants';

export function formatTargetType(targetType: TargetType) {
  const labels: Record<TargetType, string> = {
    service: '服务',
    server: '服务器',
    site: '站点',
    resource: '资源',
    backup: '备份',
    deployment: '部署',
    alert: '告警',
    manual: '项目',
  };
  return labels[targetType];
}

export function sourceTypeForTarget(targetType: TargetType, resource?: ManagedResource) {
  if (
    targetType === 'resource' &&
    (resource?.provider === 'aliyun-sls' || resource?.kind === 'log_service')
  ) {
    return 'sls';
  }

  const mapping: Record<TargetType, string> = {
    service: 'docker',
    server: 'server_executor',
    site: 'nginx',
    resource: 'manual',
    backup: 'backup',
    deployment: 'deployment',
    alert: 'alert',
    manual: 'manual',
  };
  return mapping[targetType];
}

export function sourceKeyPlaceholder(targetType: TargetType) {
  const placeholders: Record<TargetType, string> = {
    service: '容器名或 compose 服务名',
    server: '/var/log/app/app.log',
    site: 'access.log 或 error.log',
    resource: 'logstore / 实例名',
    backup: '备份任务 key',
    deployment: '构建或部署阶段',
    alert: '告警来源',
    manual: '可选',
  };
  return placeholders[targetType];
}
