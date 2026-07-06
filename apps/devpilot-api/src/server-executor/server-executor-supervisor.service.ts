import { Injectable } from "@nestjs/common";
import { ServerExecutorSupervisorHost } from "./server-executor-supervisor-host.types";
import {
  buildQueueCoordinationInput,
  buildRemoteOrphanInput,
  buildWorkerSnapshot,
} from "./server-executor-supervisor-snapshot-builder.utils";
import { buildSnapshotResult } from "./server-executor-supervisor-snapshot-result-builder.utils";
import { buildAgentSummaries } from "./server-executor-supervisor-agent-summaries.utils";
import { ServerExecutorSupervisorQueryService } from "./server-executor-supervisor-query.service";
import { ServerExecutorSupervisorWorkerSummaryService } from "./server-executor-supervisor-worker-summary.service";
import { ServerExecutorSupervisorInventorySummaryService } from "./server-executor-supervisor-inventory-summary.service";
import { ServerExecutorSupervisorQueueCoordinationSummaryService } from "./server-executor-supervisor-queue-coordination-summary.service";
import { ServerExecutorSupervisorRemoteOrphanSummaryService } from "./server-executor-supervisor-remote-orphan-summary.service";
import { ServerExecutorSupervisorAgentReadinessSummaryService } from "./server-executor-supervisor-agent-readiness-summary.service";
import { ServerExecutorSupervisorAgentBlockedReasonsSummaryService } from "./server-executor-supervisor-agent-blocked-reasons-summary.service";
import { ServerExecutorSupervisorAgentFleetSummaryService } from "./server-executor-supervisor-agent-fleet-summary.service";
import { ServerExecutorSupervisorAgentLifecycleSummaryService } from "./server-executor-supervisor-agent-lifecycle-summary.service";
import { ServerExecutorSupervisorAgentTaskPullSummaryService } from "./server-executor-supervisor-agent-task-pull-summary.service";

@Injectable()
export class ServerExecutorSupervisorService {
  constructor(
    private readonly query: ServerExecutorSupervisorQueryService,
    private readonly workerSummary: ServerExecutorSupervisorWorkerSummaryService,
    private readonly inventorySummary: ServerExecutorSupervisorInventorySummaryService,
    private readonly queueCoordinationSummary: ServerExecutorSupervisorQueueCoordinationSummaryService,
    private readonly remoteOrphanSummary: ServerExecutorSupervisorRemoteOrphanSummaryService,
    private readonly agentReadinessSummary: ServerExecutorSupervisorAgentReadinessSummaryService,
    private readonly agentBlockedReasonsSummary: ServerExecutorSupervisorAgentBlockedReasonsSummaryService,
    private readonly agentFleetSummary: ServerExecutorSupervisorAgentFleetSummaryService,
    private readonly agentLifecycleSummary: ServerExecutorSupervisorAgentLifecycleSummaryService,
    private readonly agentTaskPullSummary: ServerExecutorSupervisorAgentTaskPullSummaryService,
  ) {}

  async buildSnapshot(teamId: string, host: ServerExecutorSupervisorHost) {
    const now = new Date();
    await host.expireStaleLeases(now, teamId);

    const [
      readyQueuedJobs,
      scheduledQueuedJobs,
      runningJobs,
      staleRunningJobs,
      blockedJobs,
      failedJobs,
      cancelledJobs,
      activeLeases,
      expiredLeases,
      blockedLeases,
      nextQueuedJob,
      workerLocks,
      staleRemoteGovernanceJobs,
      agentReadyQueuedJobs,
      agentScheduledQueuedJobs,
      agentRunningJobs,
      agentStaleRunningJobs,
      agentBlockedJobs,
      agentFailedJobs,
      agentCancelledJobs,
      agentNextQueuedJob,
      agentBlockedReasonJobs,
      agentFleetJobs,
      servers,
      executionAuditEvents,
    ] = await this.query.loadSnapshotInputs(teamId, now);

    const agentReadiness = this.agentReadinessSummary.summarizeReadiness(
      servers,
      now,
      host,
    );
    const agentRuntimeHealth =
      this.agentReadinessSummary.summarizeRuntimeHealth(
        servers,
        now,
        host.capability.heartbeatDefaultTtlSeconds(),
      );
    const agentDispatcher = host.capability.readDispatcherConfig();
    const worker = buildWorkerSnapshot(host);
    const workers = this.workerSummary.summarizeWorkerLocks(workerLocks, now);
    const workerInventory = this.inventorySummary.summarizeWorkerInventory(
      worker,
      workers,
      {
        readyQueuedJobs,
        scheduledQueuedJobs,
        runningJobs,
        staleRunningJobs,
        blockedJobs,
        now,
      },
    );
    const queueCoordinationPreflight = this.queueCoordinationSummary.summarize(
      buildQueueCoordinationInput(
        worker,
        {
          readyQueuedJobs,
          scheduledQueuedJobs,
          runningJobs,
          staleRunningJobs,
          blockedJobs,
        },
        {
          total: workerInventory.owners.total,
          active: workerInventory.owners.active,
          stale: workerInventory.owners.stale,
          expired: workerInventory.owners.expired,
          unownedRunning: workerInventory.queue.unownedRunning,
        },
      ),
    );
    const remoteOrphanGovernancePreflight = this.remoteOrphanSummary.summarize(
      buildRemoteOrphanInput(worker, now, {
        staleRunningJobs,
        staleJobs: staleRemoteGovernanceJobs,
        activeOwners: workerInventory.owners.active,
        staleOwners: workerInventory.owners.stale,
        expiredOwners: workerInventory.owners.expired,
      }),
    );
    const executionAuditVisibility =
      this.workerSummary.summarizeExecutionAuditVisibility(
        executionAuditEvents,
      );
    const agentSummaries = buildAgentSummaries(
      this.agentFleetSummary,
      this.agentBlockedReasonsSummary,
      this.agentLifecycleSummary,
      this.agentTaskPullSummary,
      {
        servers,
        agentFleetJobs,
        now,
        agentDispatcher,
        agentReadiness,
        agentRuntimeHealth,
        workerQueueWorkerEnabled: worker.queueWorkerEnabled,
        heartbeatDefaultTtlSeconds:
          host.capability.heartbeatDefaultTtlSeconds(),
        heartbeatRequiredForTargetSelection:
          host.capability.heartbeatRequiredForTargetSelection(),
        taskPullContractEnabled: host.serverAgentTaskPullContractEnabled(),
        taskPullEnabled: host.serverAgentTaskPullEnabled(),
        agentReadyQueuedJobs,
        agentScheduledQueuedJobs,
        agentRunningJobs,
        agentStaleRunningJobs,
        agentBlockedJobs,
        agentFailedJobs,
        agentCancelledJobs,
        agentNextQueuedJob,
        agentBlockedReasonJobs,
        executionAuditVisibility,
      },
    );

    return buildSnapshotResult({
      now,
      worker,
      workerInventory,
      queueCoordinationPreflight,
      remoteOrphanGovernancePreflight,
      executionAuditVisibility,
      nextQueuedJob,
      queueCounts: {
        readyQueuedJobs,
        scheduledQueuedJobs,
        runningJobs,
        staleRunningJobs,
        blockedJobs,
        failedJobs,
        cancelledJobs,
      },
      activeLeases,
      expiredLeases,
      blockedLeases,
      workers,
      agentReadiness,
      agentRuntimeHealth,
      agentDispatcher,
      agentLifecyclePreflight: agentSummaries.agentLifecyclePreflight,
      agentTaskPullReadiness: agentSummaries.agentTaskPullReadiness,
      agentFleet: agentSummaries.agentFleet,
      agentBlockedReasons: agentSummaries.agentBlockedReasons,
      agentNextQueuedJobSummary: agentSummaries.agentNextQueuedJobSummary,
      agentReadyQueuedJobs,
      agentScheduledQueuedJobs,
      agentRunningJobs,
      agentStaleRunningJobs,
      agentBlockedJobs,
      agentFailedJobs,
      agentCancelledJobs,
    });
  }
}
