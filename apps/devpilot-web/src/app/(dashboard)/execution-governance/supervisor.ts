/**
 * 执行治理域 - Supervisor 快照类型
 * 单一职责：仅声明 Server 执行监控快照接口。
 */

import type { ExecutionAgentRef } from './types';

interface ServerAgentRuntimeHealthSnapshot {
  state: 'ready' | 'degraded' | 'stale' | 'unknown' | 'missing' | string;
  reason: string;
  expiringSoon: boolean;
  capabilities: string[];
  status?: string;
  lastSeenAgeSeconds?: number;
  expiresInSeconds?: number;
  heartbeatTtlSeconds?: number;
}

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
  workerInventory: {
    current: {
      workerId: string;
      queueWorkerEnabled: boolean;
      processingQueue: boolean;
      runningCancellations: number;
      queueIntervalSeconds: number;
      queueBatchSize: number;
      queueLockTtlSeconds: number;
      queueHeartbeatSeconds: number;
      recoveryBatchSize: number;
      staleRemoteCleanupEnabled: boolean;
    };
    status: {
      state: 'running' | 'degraded' | 'blocked' | 'idle' | string;
      reason: string;
    };
    queue: {
      ready: number;
      scheduled: number;
      running: number;
      staleRunning: number;
      blocked: number;
      unownedRunning: number;
    };
    owners: {
      total: number;
      active: number;
      stale: number;
      expired: number;
      ownedRunningJobs: number;
      ownedStaleJobs: number;
      samples: {
        lockOwner: string;
        status: 'running' | 'degraded' | 'expired' | string;
        runningJobs: number;
        activeJobs: number;
        staleJobs: number;
        lastHeartbeatAt?: string | null;
        lockExpiresAt?: string | null;
        lastHeartbeatAgeSeconds?: number | null;
        lockExpiresInSeconds?: number | null;
        sampleJob: {
          id: string;
          operationKey: string;
          adapterKey: string;
          serverId?: string | null;
          server?: { id: string; name: string; host: string; status: string } | null;
        };
      }[];
    };
  };
  queueCoordinationPreflight: {
    state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
    reason: string;
    gates: {
      worker: {
        ready: boolean;
        enabled: boolean;
        processingQueue: boolean;
        batchSize: number;
        intervalSeconds: number;
        reason: string;
      };
      queue: {
        ready: boolean;
        readyJobs: number;
        scheduledJobs: number;
        runningJobs: number;
        blockedJobs: number;
        backlogJobs: number;
        reason: string;
      };
      owners: {
        ready: boolean;
        totalOwners: number;
        activeOwners: number;
        staleOwners: number;
        expiredOwners: number;
        unownedRunningJobs: number;
        reason: string;
      };
      recovery: {
        ready: boolean;
        staleRunningJobs: number;
        recoveryBatchSize: number;
        staleRemoteCleanupEnabled: boolean;
        reason: string;
      };
    };
    pressure: {
      backlogJobs: number;
      readyJobs: number;
      scheduledJobs: number;
      runningJobs: number;
      staleRunningJobs: number;
      blockedJobs: number;
      totalOwners: number;
      activeOwners: number;
      staleOwners: number;
      unownedRunningJobs: number;
    };
    blockers: { reason: string; severity: 'critical' | 'warning' | string; count: number }[];
    nextSteps: { action: string; reason: string }[];
  };
  remoteOrphanGovernancePreflight: {
    state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
    reason: string;
    gates: {
      remoteSession: {
        ready: boolean;
        scannedJobs: number;
        recoverableRemoteSessions: number;
        missingRemoteSessions: number;
        invalidRemoteSessions: number;
        reason: string;
      };
      cleanup: {
        ready: boolean;
        enabled: boolean;
        cleanupRecorded: number;
        cleanupAttempted: number;
        cleanupSucceeded: number;
        cleanupFailed: number;
        reason: string;
      };
      owners: {
        ready: boolean;
        activeOwners: number;
        staleOwners: number;
        expiredOwners: number;
        unownedStaleJobs: number;
        reason: string;
      };
      recovery: {
        ready: boolean;
        staleRunningJobs: number;
        scannedJobs: number;
        unscannedStaleJobs: number;
        recoveryBatchSize: number;
        reason: string;
      };
    };
    risk: {
      staleRunningJobs: number;
      scannedJobs: number;
      unscannedStaleJobs: number;
      recoverableRemoteSessions: number;
      missingRemoteSessions: number;
      invalidRemoteSessions: number;
      cleanupRecorded: number;
      cleanupAttempted: number;
      cleanupSucceeded: number;
      cleanupFailed: number;
      activeOwners: number;
      staleOwners: number;
      expiredOwners: number;
      unownedStaleJobs: number;
    };
    samples: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId?: string | null;
      lockOwner?: string | null;
      lockExpiresAt?: string | null;
      lastHeartbeatAt?: string | null;
      server?: { id: string; name: string; host: string; status: string } | null;
      remoteSession?: {
        transport: string;
        pid: number;
        observedAt: string;
        serverId?: string | null;
        serverHost?: string | null;
        cleanupStrategy: string;
      } | null;
      cleanup?: {
        attempted: boolean;
        succeeded: boolean;
        failed: boolean;
        reason: string;
        observedAt?: string | null;
        error?: string | null;
      } | null;
    }[];
    blockers: { reason: string; severity: 'critical' | 'warning' | string; count: number }[];
    nextSteps: { action: string; reason: string }[];
  };
  executionAuditVisibility: {
    totalRecent: number;
    failedRecent: number;
    blockedRecent: number;
    highRiskRecent: number;
    statuses: { status: string; count: number }[];
    risks: { risk: string; count: number }[];
    actions: { action: string; count: number }[];
    samples: {
      id: string;
      action: string;
      targetId?: string | null;
      serverExecutionJobId?: string | null;
      risk: string;
      status: string;
      summary?: string | null;
      occurredAt: string;
      actor?: { id: string; name?: string | null; email?: string | null } | null;
      project?: { id: string; name: string } | null;
      environment?: { id: string; key: string; name: string; status: string } | null;
      server?: { id: string; name: string; host: string; status: string } | null;
      metadata?: {
        serverExecutionJobId?: string | null;
        operationKey?: string;
        adapterKey?: string;
        transport?: string;
        queueMode?: string;
        dryRun?: boolean;
        attempt?: number;
        maxAttempts?: number;
        resultStatus?: string;
        resultMode?: string;
      };
    }[];
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
    runtimeHealth: {
      totalServers: number;
      readyServers: number;
      degradedServers: number;
      staleServers: number;
      unknownServers: number;
      missingHeartbeatServers: number;
      expiringSoonServers: number;
      statusCounts: { status: string; count: number }[];
      samples: {
        id: string;
        name: string;
        host: string;
        status: string;
        agentRef: ExecutionAgentRef;
        health: ServerAgentRuntimeHealthSnapshot;
      }[];
    };
    statusCounts: { status: string; count: number }[];
    dispatcher: {
      executorEnabled: boolean;
      dispatcherConfigured: boolean;
      dispatcherUrl?: string | null;
      timeoutSeconds: number;
      tokenConfigured: boolean;
    };
    lifecyclePreflight: {
      state: 'ready' | 'degraded' | 'blocked' | 'disabled' | string;
      reason: string;
      gates: {
        targetSelection: {
          ready: boolean;
          enabled: boolean;
          capableServers: number;
          onlineCapableServers: number;
          reason: string;
        };
        heartbeat: {
          ready: boolean;
          enabled: boolean;
          tokenConfigured: boolean;
          requiredForTargetSelection: boolean;
          heartbeatServers: number;
          readyServers: number;
          issueServers: number;
          missingHeartbeatServers: number;
          reason: string;
        };
        dispatcher: {
          ready: boolean;
          executorEnabled: boolean;
          dispatcherConfigured: boolean;
          tokenConfigured: boolean;
          liveDispatchReadyServers: number;
          reason: string;
        };
        queueWorker: {
          ready: boolean;
          enabled: boolean;
          queuedJobs: number;
          runningJobs: number;
          staleRunningJobs: number;
          blockedJobs: number;
          reason: string;
        };
      };
      pressure: {
        servers: number;
        scannedJobs: number;
        queuedJobs: number;
        runningJobs: number;
        blockedJobs: number;
      };
      blockers: { reason: string; severity: 'critical' | 'warning' | string; count: number }[];
      nextSteps: { action: string; reason: string }[];
    };
    taskPullReadiness: {
      state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
      reason: string;
      gates: {
        runtime: {
          ready: boolean;
          targetSelectionEnabled: boolean;
          capableServers: number;
          onlineCapableServers: number;
          heartbeatEnabled: boolean;
          heartbeatTokenConfigured: boolean;
          heartbeatRequiredForTargetSelection: boolean;
          heartbeatServers: number;
          readyServers: number;
          issueServers: number;
          missingHeartbeatServers: number;
          reason: string;
        };
        queue: {
          ready: boolean;
          queueWorkerEnabled: boolean;
          readyJobs: number;
          scheduledJobs: number;
          runningJobs: number;
          staleRunningJobs: number;
          blockedJobs: number;
          failedJobs: number;
          cancelledJobs: number;
          reason: string;
        };
        pullContract: {
          ready: boolean;
          endpointImplemented: boolean;
          contractEndpointEnabled?: boolean;
          pullEndpointImplemented?: boolean;
          taskPullEnabled?: boolean;
          claimSupported: boolean;
          ackSupported: boolean;
          lifecycleExecutionSupported?: boolean;
          reason: string;
        };
        audit: {
          ready: boolean;
          totalRecent: number;
          failedRecent: number;
          blockedRecent: number;
          highRiskRecent: number;
          reason: string;
        };
      };
      pressure: {
        readyJobs: number;
        scheduledJobs: number;
        runningJobs: number;
        staleRunningJobs: number;
        blockedJobs: number;
        failedJobs: number;
        cancelledJobs: number;
        pressureJobs: number;
      };
      samples: {
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
        blockedReasons: { reason: string; count: number; nextExecutorBoundary?: string }[];
        blockedReasonSamples: {
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
      blockers: { reason: string; severity: 'critical' | 'warning' | string; count: number }[];
      nextSteps: { action: string; reason: string }[];
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
    fleet: {
      totalServers: number;
      liveDispatchReadyServers: number;
      pressureServers: number;
      scannedJobs: number;
      truncated: boolean;
      items: {
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
        runtimeHealth: ServerAgentRuntimeHealthSnapshot;
        readiness: {
          targetReady: boolean;
          liveDispatchReady: boolean;
          blockingReasons: string[];
        };
        jobs: {
          ready: number;
          scheduled: number;
          running: number;
          staleRunning: number;
          blocked: number;
          failed: number;
          cancelled: number;
          pressure: number;
          nextQueuedJob?: {
            id: string;
            operationKey: string;
            adapterKey: string;
            serverId?: string | null;
            status: string;
            priority: number;
            queuedAt: string;
            availableAt: string;
            finishedAt?: string | null;
            server?: { id: string; name: string; host: string; status: string } | null;
          } | null;
          blockedSample?: {
            id: string;
            operationKey: string;
            adapterKey: string;
            serverId?: string | null;
            status: string;
            priority: number;
            queuedAt: string;
            availableAt: string;
            finishedAt?: string | null;
            server?: { id: string; name: string; host: string; status: string } | null;
            reason: string;
            nextExecutorBoundary?: string;
            dispatcherConfigured?: boolean;
            agentExecutorEnabled?: boolean;
          } | null;
        };
      }[];
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
