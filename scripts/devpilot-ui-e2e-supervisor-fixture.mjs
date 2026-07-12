import {
  auditVisibilityFixture,
  queueCoordinationFixture,
  remoteOrphanFixture,
  workerInventoryFixture,
} from "./devpilot-ui-e2e-supervisor-secondary-fixture.mjs";

function taskPullFixture(blockers) {
  return {
    state: "ready",
    reason: "ready",
    gates: {
      runtime: { readyServers: 1, capableServers: 1, reason: "ready" },
      queue: {
        readyJobs: 1,
        scheduledJobs: 1,
        runningJobs: 0,
        reason: "ready",
      },
      pullContract: { reason: "enabled" },
      audit: {
        totalRecent: 1,
        failedRecent: 0,
        blockedRecent: 0,
        highRiskRecent: 0,
        reason: "clean",
      },
    },
    pressure: { readyJobs: 1, runningJobs: 0, blockedJobs: 0, failedJobs: 0 },
    samples: {
      nextQueuedJob: {
        id: "job-demo",
        operationKey: "deploy",
        server: { name: "devpilot-demo-target" },
      },
    },
    blockers,
    nextSteps: [{ action: "run_agent_task_pull", reason: "ready" }],
  };
}

function agentFixture(blockers) {
  return {
    totalServers: 1,
    capableServers: 1,
    serviceCapabilityServers: 1,
    tagCapabilityServers: 0,
    onlineCapableServers: 1,
    targetSelectionEnabled: true,
    dispatcher: {
      executorEnabled: true,
      dispatcherConfigured: true,
      timeoutSeconds: 30,
      tokenConfigured: true,
      dispatcherUrl: "mock://agent",
    },
    runtime: {
      heartbeatEnabled: true,
      tokenConfigured: true,
      onlineServers: 1,
      staleServers: 0,
      unknownServers: 0,
    },
    runtimeHealth: {
      readyServers: 1,
      totalServers: 1,
      degradedServers: 0,
      staleServers: 0,
      missingHeartbeatServers: 0,
      expiringSoonServers: 0,
      samples: [],
    },
    statusCounts: [{ status: "online", count: 1 }],
    fleet: {
      liveDispatchReadyServers: 1,
      totalServers: 1,
      pressureServers: 0,
      scannedJobs: 1,
      items: [],
      truncated: false,
    },
    jobs: {
      ready: 1,
      scheduled: 1,
      running: 0,
      staleRunning: 0,
      blocked: 0,
      failed: 0,
      cancelled: 0,
    },
    samples: [],
    lifecyclePreflight: lifecyclePreflightFixture(blockers),
    taskPullReadiness: taskPullFixture(blockers),
  };
}

function lifecyclePreflightFixture(blockers) {
  return {
    state: "ready",
    reason: "ready",
    gates: {
      targetSelection: {
        capableServers: 1,
        onlineCapableServers: 1,
        reason: "ready",
      },
      heartbeat: { readyServers: 1, heartbeatServers: 1, reason: "ready" },
      dispatcher: { liveDispatchReadyServers: 1, reason: "ready" },
      queueWorker: {
        queuedJobs: 1,
        runningJobs: 0,
        blockedJobs: 0,
        reason: "ready",
      },
    },
    pressure: { servers: 1, scannedJobs: 1 },
    blockers,
    nextSteps: [],
  };
}

export function supervisorFixture() {
  const blockers = [];
  return {
    queue: {
      ready: 1,
      scheduled: 1,
      running: 0,
      staleRunning: 0,
      nextQueuedJob: {
        operationKey: "deploy",
        adapterKey: "server_agent",
        server: { name: "devpilot-demo-target" },
      },
    },
    leases: { running: 0 },
    workers: [],
    worker: {
      workerId: "worker-demo",
      queueWorkerEnabled: true,
      processingQueue: false,
      runningCancellations: 0,
      queueBatchSize: 1,
      queueIntervalSeconds: 5,
      queueLockTtlSeconds: 30,
      queueHeartbeatSeconds: 10,
      cancellationPollSeconds: 5,
      staleRemoteCleanupEnabled: true,
    },
    workerInventory: workerInventoryFixture(),
    queueCoordinationPreflight: queueCoordinationFixture(blockers),
    remoteOrphanGovernancePreflight: remoteOrphanFixture(blockers),
    executionAuditVisibility: auditVisibilityFixture(),
    agent: agentFixture(blockers),
  };
}
