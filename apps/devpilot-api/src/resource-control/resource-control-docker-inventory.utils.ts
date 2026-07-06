/**
 * Pure docker-inventory stub + server-execution summary helpers.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * sync service stays under the 200-line ceiling. Stateless. No behavior change.
 */

import { ServerExecutionResult } from '../server-executor';
import { asRecord } from './resource-control-value.utils';

type ManagedResourceSeed = {
  sourceType: string; provider: string; kind: string; name: string; externalId: string;
  status: string; endpoint?: string; serverId?: string; projectId?: string;
  environmentId?: string; credentialId?: string; metadata?: Record<string, unknown>; config?: Record<string, unknown>;
};

type ServerInventorySource = { id: string; name: string; host: string; status: string; services: unknown };
type EnvironmentRef = { id: string; projectId: string; key: string; name: string };

export function summarizeServerExecution(execution: ServerExecutionResult) {
  return {
    status: execution.status, mode: execution.mode, adapterKey: execution.adapterKey,
    executable: execution.executable, warnings: execution.warnings, error: execution.error,
  };
}

export function readServerExecutionStdout(execution: ServerExecutionResult) {
  const result = asRecord(execution.result);
  if (typeof result.stdoutPreview === 'string') return result.stdoutPreview;
  const logs = Array.isArray(execution.logs) ? execution.logs : [];
  const stdoutLog = logs.find((item) => {
    const record = asRecord(item);
    return record.stream === 'stdout' && typeof record.message === 'string';
  });
  if (stdoutLog) {
    const record = asRecord(stdoutLog);
    return typeof record.message === 'string' ? record.message : undefined;
  }
  return undefined;
}

export function buildServerDockerInventory(
  server: ServerInventorySource, dto: { includeContainers?: boolean; includeMiddleware?: boolean },
  environment?: EnvironmentRef | null,
): ManagedResourceSeed[] {
  const seeds: ManagedResourceSeed[] = [];
  const includeContainers = dto.includeContainers !== false;
  const includeMiddleware = dto.includeMiddleware !== false;
  const runtimeStatus = server.status === 'offline' ? 'unknown' : 'running';

  if (includeContainers) {
    seeds.push(
      {
        sourceType: 'server', provider: 'docker', kind: 'docker_container',
        name: `${server.name} / devpilot-api`, externalId: `${server.id}:docker:container:devpilot-api`,
        status: runtimeStatus, endpoint: `${server.host}:3101`, serverId: server.id,
        projectId: environment?.projectId, environmentId: environment?.id,
        metadata: { syncMode: 'inventory_stub', serverName: server.name, environmentKey: environment?.key, image: 'svton/devpilot-api:latest', ports: ['3101:3101'] },
        config: { containerName: 'devpilot-api', restartPolicy: 'unless-stopped' },
      },
      {
        sourceType: 'server', provider: 'docker', kind: 'docker_container',
        name: `${server.name} / nginx-proxy`, externalId: `${server.id}:docker:container:nginx-proxy`,
        status: runtimeStatus, endpoint: `${server.host}:80`, serverId: server.id,
        projectId: environment?.projectId, environmentId: environment?.id,
        metadata: { syncMode: 'inventory_stub', serverName: server.name, environmentKey: environment?.key, image: 'nginx:stable', ports: ['80:80', '443:443'] },
        config: { containerName: 'nginx-proxy', restartPolicy: 'always' },
      },
    );
  }

  if (includeMiddleware) {
    seeds.push(
      {
        sourceType: 'server', provider: 'docker', kind: 'mysql',
        name: `${server.name} / mysql-primary`, externalId: `${server.id}:docker:mysql:mysql-primary`,
        status: 'active', endpoint: `${server.host}:3306`, serverId: server.id,
        projectId: environment?.projectId, environmentId: environment?.id,
        metadata: { syncMode: 'inventory_stub', serverName: server.name, environmentKey: environment?.key, engine: 'mysql', deployedBy: 'docker' },
        config: { databaseEngine: 'mysql', containerName: 'mysql-primary', port: 3306 },
      },
      {
        sourceType: 'server', provider: 'docker', kind: 'redis',
        name: `${server.name} / redis-cache`, externalId: `${server.id}:docker:redis:redis-cache`,
        status: 'active', endpoint: `${server.host}:6379`, serverId: server.id,
        projectId: environment?.projectId, environmentId: environment?.id,
        metadata: { syncMode: 'inventory_stub', serverName: server.name, environmentKey: environment?.key, engine: 'redis', deployedBy: 'docker' },
        config: { databaseEngine: 'redis', containerName: 'redis-cache', port: 6379 },
      },
    );
  }

  return seeds;
}
