/**
 * Pure connection-probe step / target / sdk-call helpers.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * connection-probe executor service stays under the 200-line ceiling.
 * Stateless — no service / DB dependencies. No behavior change.
 */

import { Prisma } from '@prisma/client';
import { ServerCommandStep } from '../server-executor';
import { asRecord, asString } from './resource-control-value.utils';

type ManagedResourceForConnection = {
  id: string; sourceType: string; provider: string; kind: string; name: string;
  externalId: string; status: string; endpoint: string | null;
  projectId: string | null; environmentId: string | null; serverId: string | null;
  credentialId: string | null; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
};

export function buildServerConnectionSteps(resource: {
  kind: string; provider: string; name: string; externalId: string;
  config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
}) {
  const warnings: string[] = [];
  const containerName = resolveContainerName(resource);
  const steps: ServerCommandStep[] = [];
  if (!containerName) warnings.push('未找到可用于连接探测的 Docker 容器名。');

  if (resource.kind === 'docker_container') {
    steps.push({ key: 'docker-container-inspect', label: '检查 Docker 容器可达性',
      command: containerName ? `docker inspect ${containerName}` : '', required: true, risk: 'low', timeoutSeconds: 20 });
    return { steps, warnings };
  }
  if (resource.kind === 'mysql' || resource.kind === 'database') {
    steps.push({ key: 'mysqladmin-ping', label: '探测 MySQL 连接',
      command: containerName ? `docker exec ${containerName} mysqladmin ping -h 127.0.0.1 -P ${resolveResourcePort(resource, 3306)}` : '',
      required: true, risk: 'low', timeoutSeconds: 20 });
    return { steps, warnings };
  }
  if (resource.kind === 'redis') {
    steps.push({ key: 'redis-ping', label: '探测 Redis 连接',
      command: containerName ? `docker exec ${containerName} redis-cli PING` : '',
      required: true, risk: 'low', timeoutSeconds: 20 });
    return { steps, warnings };
  }
  warnings.push(`暂不支持 ${resource.provider}/${resource.kind} 的服务器连接探测。`);
  steps.push({ key: 'unsupported-resource-connection', label: '不支持的服务器资源连接探测',
    command: '', required: true, risk: 'low', timeoutSeconds: 20 });
  return { steps, warnings };
}

export function buildConnectionTarget(resource: {
  id: string; name: string; sourceType: string; provider: string; kind: string;
  endpoint: string | null; externalId: string; serverId: string | null; credentialId: string | null;
}) {
  return {
    resourceId: resource.id, resourceName: resource.name, sourceType: resource.sourceType,
    provider: resource.provider, kind: resource.kind, endpoint: resource.endpoint,
    externalId: resource.externalId, serverId: resource.serverId, credentialId: resource.credentialId,
  };
}

export function sanitizeDockerName(value?: string) {
  const trimmed = value?.trim() || '';
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 128) || '';
}

export function resolveContainerName(resource: {
  name: string; externalId: string; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
}) {
  const config = asRecord(resource.config);
  const metadata = asRecord(resource.metadata);
  const rawName =
    asString(config.containerName) ||
    asString(metadata.containerName) ||
    resource.name.split('/').pop()?.trim() ||
    resource.externalId.split(':').pop() ||
    resource.name;
  return sanitizeDockerName(rawName);
}

export function resolveResourcePort(resource: { config: Prisma.JsonValue | null }, fallback: number) {
  const config = asRecord(resource.config);
  const port = config.port;
  if (typeof port === 'number' && Number.isFinite(port)) {
    return Math.max(1, Math.min(Math.floor(port), 65535));
  }
  if (typeof port === 'string') {
    const parsed = Number(port);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(Math.floor(parsed), 65535));
    }
  }
  return fallback;
}

export function sdkCallsForConnectionProbe(resource: ManagedResourceForConnection, params: Record<string, unknown>) {
  const config = asRecord(resource.config);
  const metadata = asRecord(resource.metadata);
  const region = asString(metadata.region) || asString(params.region) || 'default';

  if (resource.provider === 'aliyun-rds') {
    return [{
      provider: 'aliyun-rds', operation: 'DescribeDBInstanceAttribute',
      params: { region, instanceId: resource.externalId.split(':').pop(), endpoint: resource.endpoint },
    }];
  }
  if (resource.provider === 'aliyun-sls') {
    return [{
      provider: 'aliyun-sls', operation: 'ListLogStores',
      params: { region, project: asString(config.project) || resource.name },
    }];
  }
  if (resource.provider === 'tencent-cos') {
    return [{
      provider: 'tencent-cos', operation: 'HeadBucket',
      params: { region, bucket: asString(config.bucket) || resource.name },
    }];
  }
  return [{ provider: resource.provider, operation: 'ConnectionProbe', params: { region, resourceId: resource.externalId } }];
}
