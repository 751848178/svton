import { ServerExecutorSupervisorRemoteOrphanSummaryService } from "./server-executor-supervisor-remote-orphan-summary.service";
import type { RemoteOrphanGovernancePreflightInput } from "./server-executor-supervisor-remote-orphan-input.types";

describe("ServerExecutorSupervisorRemoteOrphanSummaryService", () => {
  it("blocks production governance when recoverable sessions exist but cleanup is disabled", () => {
    const summary =
      new ServerExecutorSupervisorRemoteOrphanSummaryService().summarize({
        ...baseInput(),
        staleRemoteCleanupEnabled: false,
        staleRunningJobs: 1,
        staleJobs: [buildRemoteJob("job-1")],
      });

    expect(summary).toMatchObject({
      state: "blocked",
      reason: "remote_cleanup_disabled_with_recoverable_sessions",
      gates: {
        remoteSession: {
          ready: true,
          recoverableRemoteSessions: 1,
          reason: "remote_sessions_tracked",
        },
        cleanup: {
          ready: false,
          enabled: false,
          reason: "remote_cleanup_disabled_with_recoverable_sessions",
        },
      },
      blockers: [
        {
          reason: "remote_cleanup_disabled_with_recoverable_sessions",
          severity: "critical",
          count: 1,
        },
      ],
      nextSteps: [
        {
          action: "enable_stale_remote_cleanup",
          reason: "remote_cleanup_disabled_with_recoverable_sessions",
        },
      ],
    });
  });

  it("surfaces cleanup failures and truncated stale-job scans", () => {
    const summary =
      new ServerExecutorSupervisorRemoteOrphanSummaryService().summarize({
        ...baseInput(),
        staleRunningJobs: 3,
        recoveryBatchSize: 2,
        staleJobs: [
          buildRemoteJob("job-1", {
            staleCleanup: {
              attempted: true,
              succeeded: false,
              reason: "stale_recovery",
              observedAt: "2026-07-12T14:00:00.000Z",
              error: "ssh failed",
            },
          }),
        ],
      });

    expect(summary).toMatchObject({
      state: "degraded",
      reason: "remote_cleanup_failed",
      gates: {
        cleanup: {
          ready: true,
          enabled: true,
          cleanupAttempted: 1,
          cleanupFailed: 1,
        },
        recovery: {
          ready: false,
          staleRunningJobs: 3,
          scannedJobs: 1,
          unscannedStaleJobs: 2,
          reason: "stale_jobs_scan_truncated",
        },
      },
      blockers: expect.arrayContaining([
        {
          reason: "remote_cleanup_failed",
          severity: "warning",
          count: 1,
        },
        {
          reason: "stale_jobs_scan_truncated",
          severity: "warning",
          count: 2,
        },
        {
          reason: "recovery_batch_below_stale_jobs",
          severity: "warning",
          count: 1,
        },
      ]),
      nextSteps: expect.arrayContaining([
        {
          action: "inspect_failed_remote_cleanup",
          reason: "remote_cleanup_failed",
        },
        {
          action: "expand_stale_job_scan",
          reason: "stale_jobs_scan_truncated",
        },
      ]),
    });
  });
});

function baseInput(): RemoteOrphanGovernancePreflightInput {
  return {
    now: new Date("2026-07-12T14:00:00.000Z"),
    staleRemoteCleanupEnabled: true,
    recoveryBatchSize: 5,
    staleRunningJobs: 0,
    activeOwners: 1,
    staleOwners: 0,
    expiredOwners: 0,
    staleJobs: [],
  };
}

function buildRemoteJob(
  id: string,
  remoteExecutionOverrides: Record<string, unknown> = {},
) {
  return {
    id,
    operationKey: "deployment.run",
    adapterKey: "ssh-live",
    serverId: "server-1",
    lockOwner: "worker-1",
    lastHeartbeatAt: new Date("2026-07-12T13:55:00.000Z"),
    lockExpiresAt: new Date("2026-07-12T13:58:00.000Z"),
    metadata: {
      remoteExecution: {
        session: {
          transport: "ssh",
          pid: 4321,
          observedAt: "2026-07-12T13:54:00.000Z",
          operationKey: "deployment.run",
          adapterKey: "ssh-live",
          serverId: "server-1",
          serverHost: "10.0.0.1",
          cleanupStrategy: "best_effort_ssh",
        },
        ...remoteExecutionOverrides,
      },
    },
    server: {
      id: "server-1",
      name: "prod-1",
      host: "10.0.0.1",
      status: "online",
    },
  };
}
