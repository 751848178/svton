import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorSupervisorJobQueryService } from "./server-executor-supervisor-job-query.service";
import { ServerExecutorSupervisorAgentJobQueryService } from "./server-executor-supervisor-agent-job-query.service";

/**
 * Facade that assembles the full supervisor snapshot input tuple in the order the
 * orchestrator destructures. Owns the lease/server/audit queries directly and
 * delegates the job/agent-job query groups to focused services.
 */
@Injectable()
export class ServerExecutorSupervisorQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQuery: ServerExecutorSupervisorJobQueryService,
    private readonly agentJobQuery: ServerExecutorSupervisorAgentJobQueryService,
  ) {}

  async loadSnapshotInputs(teamId: string, now: Date) {
    const [
      readyQueuedJobs,
      scheduledQueuedJobs,
      runningJobs,
      staleRunningJobs,
      blockedJobs,
      failedJobs,
      cancelledJobs,
    ] = await this.jobQuery.loadJobCounts(teamId, now);
    const nextQueuedJob = await this.jobQuery.loadNextQueuedJob(teamId, now);
    const workerLocks = await this.jobQuery.loadWorkerLocks(teamId);
    const staleRemoteGovernanceJobs =
      await this.jobQuery.loadStaleRemoteGovernanceJobs(teamId, now);
    const [activeLeases, expiredLeases, blockedLeases] =
      await this.loadLeaseCounts(teamId);
    const [
      agentReadyQueuedJobs,
      agentScheduledQueuedJobs,
      agentRunningJobs,
      agentStaleRunningJobs,
      agentBlockedJobs,
      agentFailedJobs,
      agentCancelledJobs,
    ] = await this.agentJobQuery.loadAgentJobCounts(teamId, now);
    const agentNextQueuedJob = await this.agentJobQuery.loadAgentNextQueuedJob(
      teamId,
      now,
    );
    const agentBlockedReasonJobs =
      await this.agentJobQuery.loadAgentBlockedReasonJobs(teamId);
    const agentFleetJobs = await this.agentJobQuery.loadAgentFleetJobs(teamId);
    const [servers, executionAuditEvents] =
      await this.loadServersAndAudit(teamId);

    return [
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
    ] as const;
  }

  private async loadLeaseCounts(teamId: string) {
    return Promise.all([
      this.prisma.serverExecutionLease.count({
        where: { teamId, status: "running" },
      }),
      this.prisma.serverExecutionLease.count({
        where: { teamId, status: "expired" },
      }),
      this.prisma.serverExecutionLease.count({
        where: { teamId, status: "blocked" },
      }),
    ]);
  }

  private async loadServersAndAudit(teamId: string) {
    return Promise.all([
      this.prisma.server.findMany({
        where: { teamId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          host: true,
          status: true,
          services: true,
          tags: true,
        },
      }),
      this.prisma.auditEvent.findMany({
        where: {
          teamId,
          category: "execution",
          targetType: "server_execution_job",
        },
        orderBy: { occurredAt: "desc" },
        take: 12,
        select: {
          id: true,
          action: true,
          targetId: true,
          risk: true,
          status: true,
          summary: true,
          metadata: true,
          occurredAt: true,
          actor: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          environment: {
            select: { id: true, key: true, name: true, status: true },
          },
          server: {
            select: { id: true, name: true, host: true, status: true },
          },
        },
      }),
    ]);
  }
}
