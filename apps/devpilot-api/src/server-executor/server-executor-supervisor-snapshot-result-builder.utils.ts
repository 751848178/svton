import {
  SupervisorQueueCounts,
  SupervisorQueuedJobSample,
} from "./server-executor-supervisor.types";
import { buildQueueSummary } from "./server-executor-supervisor-snapshot-builder.utils";

type WorkerSnapshot =
  import("./server-executor-supervisor-snapshot-builder.utils").WorkerSnapshot;

export type SnapshotResultArgs = {
  now: Date;
  worker: WorkerSnapshot;
  workerInventory: Record<string, unknown>;
  queueCoordinationPreflight: unknown;
  remoteOrphanGovernancePreflight: unknown;
  executionAuditVisibility: {
    totalRecent: number;
    failedRecent: number;
    blockedRecent: number;
    highRiskRecent: number;
  };
  nextQueuedJob: SupervisorQueuedJobSample | null;
  queueCounts: SupervisorQueueCounts;
  activeLeases: number;
  expiredLeases: number;
  blockedLeases: number;
  workers: unknown;
  agentReadiness: Record<string, unknown> & {
    runtime: Record<string, unknown>;
  };
  agentRuntimeHealth: unknown;
  agentDispatcher: unknown;
  agentLifecyclePreflight: unknown;
  agentTaskPullReadiness: unknown;
  agentFleet: unknown;
  agentBlockedReasons: unknown;
  agentNextQueuedJobSummary: unknown;
  agentReadyQueuedJobs: number;
  agentScheduledQueuedJobs: number;
  agentRunningJobs: number;
  agentStaleRunningJobs: number;
  agentBlockedJobs: number;
  agentFailedJobs: number;
  agentCancelledJobs: number;
};

export function buildSnapshotResult(args: SnapshotResultArgs) {
  return {
    generatedAt: args.now.toISOString(),
    worker: args.worker,
    workerInventory: args.workerInventory,
    queueCoordinationPreflight: args.queueCoordinationPreflight,
    remoteOrphanGovernancePreflight: args.remoteOrphanGovernancePreflight,
    executionAuditVisibility: args.executionAuditVisibility,
    queue: buildQueueSummary(args.nextQueuedJob, args.queueCounts),
    leases: {
      running: args.activeLeases,
      expired: args.expiredLeases,
      blocked: args.blockedLeases,
    },
    workers: args.workers,
    agent: {
      ...args.agentReadiness,
      runtimeHealth: args.agentRuntimeHealth,
      dispatcher: args.agentDispatcher,
      lifecyclePreflight: args.agentLifecyclePreflight,
      taskPullReadiness: args.agentTaskPullReadiness,
      fleet: args.agentFleet,
      jobs: {
        ready: args.agentReadyQueuedJobs,
        scheduled: args.agentScheduledQueuedJobs,
        running: args.agentRunningJobs,
        staleRunning: args.agentStaleRunningJobs,
        blocked: args.agentBlockedJobs,
        failed: args.agentFailedJobs,
        cancelled: args.agentCancelledJobs,
        nextQueuedJob: args.agentNextQueuedJobSummary,
        blockedReasons: args.agentBlockedReasons,
      },
    },
  };
}
