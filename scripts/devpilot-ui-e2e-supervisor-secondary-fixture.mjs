export function workerInventoryFixture() {
  return {
    current: { workerId: "worker-demo", queueWorkerEnabled: true },
    status: { state: "ready", reason: "ready" },
    queue: {
      ready: 1,
      scheduled: 1,
      running: 0,
      staleRunning: 0,
      unownedRunning: 0,
    },
    owners: {
      total: 1,
      active: 1,
      stale: 0,
      ownedRunningJobs: 0,
      ownedStaleJobs: 0,
      samples: [],
    },
  };
}

export function queueCoordinationFixture(blockers) {
  return {
    state: "ready",
    reason: "ready",
    gates: {
      worker: { enabled: true, reason: "ready" },
      queue: {
        readyJobs: 1,
        scheduledJobs: 1,
        blockedJobs: 0,
        reason: "ready",
      },
      owners: { activeOwners: 1, totalOwners: 1, reason: "ready" },
      recovery: { staleRunningJobs: 0, recoveryBatchSize: 10, reason: "ready" },
    },
    pressure: { backlogJobs: 1, runningJobs: 0, blockedJobs: 0 },
    blockers,
    nextSteps: [],
  };
}

export function remoteOrphanFixture(blockers) {
  return {
    state: "ready",
    reason: "ready",
    gates: {
      remoteSession: {
        recoverableRemoteSessions: 0,
        scannedJobs: 1,
        reason: "ready",
      },
      cleanup: {
        enabled: true,
        cleanupAttempted: 0,
        cleanupSucceeded: 0,
        cleanupFailed: 0,
      },
      owners: {
        activeOwners: 1,
        staleOwners: 0,
        expiredOwners: 0,
        reason: "ready",
      },
      recovery: {
        staleRunningJobs: 0,
        scannedJobs: 1,
        unscannedStaleJobs: 0,
        reason: "ready",
      },
    },
    risk: {
      missingRemoteSessions: 0,
      invalidRemoteSessions: 0,
      cleanupFailed: 0,
    },
    blockers,
    nextSteps: [],
    samples: [],
  };
}

export function auditVisibilityFixture() {
  return {
    totalRecent: 1,
    failedRecent: 0,
    blockedRecent: 0,
    highRiskRecent: 0,
    statuses: [{ status: "completed", count: 1 }],
    risks: [{ risk: "low", count: 1 }],
    actions: [{ action: "finish", count: 1 }],
    samples: [],
  };
}
