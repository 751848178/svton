/**
 * 执行治理域 - Supervisor 快照类型
 * 单一职责：仅声明 Server 执行监控快照接口。
 */

import type { ExecutionAgentRef } from './types';

export interface ServerExecutionSupervisorSnapshot {
  generatedAt: string;
  worker: {
    workerId: string;
    queueWorkerEnabled: boolean;
    processingQueue: boolean;
    runningCancellations: number;
    queueIntervalSeconds: number;
    queueBatchSize: number;
    retryDelaySeconds: number;
    queueLockTtlSeconds: number;
    queueHeartbeatSeconds: number;
    cancellationPollSeconds: number;
    recoveryBatchSize: number;
    staleRemoteCleanupEnabled: boolean;
  };
  queue: {
    ready: number;
    scheduled: number;
    running: number;
    staleRunning: number;
    blocked: number;
    failed: number;
    cancelled: number;
    nextQueuedJob?: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId?: string | null;
      priority: number;
      queuedAt: string;
      availableAt: string;
      server?: { id: string; name: string; host: string; status: string } | null;
    } | null;
  };
  leases: {
    running: number;
    expired: number;
    blocked: number;
  };
  workers: {
    lockOwner: string;
    runningJobs: number;
    staleJobs: number;
    lastHeartbeatAt?: string | null;
    lockExpiresAt?: string | null;
    sampleJob: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId?: string | null;
      server?: { id: string; name: string; host: string; status: string } | null;
    };
  }[];
  agent: {
    targetSelectionEnabled: boolean;
    totalServers: number;
    capableServers: number;
    serviceCapabilityServers: number;
    tagCapabilityServers: number;
    onlineCapableServers: number;
    runtime: {
      heartbeatEnabled: boolean;
      tokenConfigured: boolean;
      requiredForTargetSelection: boolean;
      defaultTtlSeconds: number;
      heartbeatServers: number;
      onlineServers: number;
      staleServers: number;
      unknownServers: number;
    };
    statusCounts: { status: string; count: number }[];
    dispatcher: {
      executorEnabled: boolean;
      dispatcherConfigured: boolean;
      dispatcherUrl?: string | null;
      timeoutSeconds: number;
      tokenConfigured: boolean;
    };
    jobs: {
      ready: number;
      scheduled: number;
      running: number;
      staleRunning: number;
      blocked: number;
      failed: number;
      cancelled: number;
      nextQueuedJob?: {
        id: string;
        operationKey: string;
        adapterKey: string;
        serverId?: string | null;
        priority: number;
        queuedAt: string;
        availableAt: string;
        server?: { id: string; name: string; host: string; status: string } | null;
      } | null;
      blockedReasons: {
        scanned: number;
        dispatcherBoundaryJobs: number;
        reasonCounts: { reason: string; count: number; nextExecutorBoundary?: string }[];
        samples: {
          id: string;
          operationKey: string;
          adapterKey: string;
          serverId?: string | null;
          queuedAt: string;
          finishedAt?: string | null;
          server?: { id: string; name: string; host: string; status: string } | null;
          reason: string;
          nextExecutorBoundary?: string;
          dispatcherConfigured?: boolean;
          agentExecutorEnabled?: boolean;
        }[];
      };
    };
    samples: {
      id: string;
      name: string;
      host: string;
      status: string;
      agentRef: ExecutionAgentRef;
      runtime?: {
        state: string;
        status?: string;
        agentId?: string;
        runnerId?: string;
        hostname?: string;
        version?: string;
        lastSeenAt?: string;
        expiresAt?: string;
        heartbeatTtlSeconds?: number;
        capabilities: string[];
      };
    }[];
  };
}
