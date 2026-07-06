import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorStaleRemoteCleanupService } from "./server-executor-stale-remote-cleanup.service";

export type RecoverStaleJobsResult = {
  recovered: number;
  retryJobIds: string[];
  remoteCleanups: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
};

type StaleRunningJob = {
  id: string;
  teamId: string;
  actorId: string | null;
  serverId: string | null;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  retryOfId: string | null;
  inputSnapshot: Prisma.JsonValue;
  metadata: Prisma.JsonValue | null;
  lockOwner: string | null;
  lockExpiresAt: Date | null;
};

export class ServerExecutorStaleRunningJobRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService,
    private readonly auditService: ServerExecutorAuditService,
    private readonly staleRemoteCleanupService: ServerExecutorStaleRemoteCleanupService,
    private readonly queueRecoveryBatchSize: () => number,
    private readonly queueRetryDelayMs: () => number,
  ) {}

  async recoverStaleRunningJobs(
    teamId?: string,
    actorId?: string,
  ): Promise<RecoverStaleJobsResult> {
    const now = new Date();
    const staleJobs = await this.prisma.serverExecutionJob.findMany({
      where: {
        teamId,
        status: "running",
        lockExpiresAt: { lte: now },
      },
      orderBy: { lockExpiresAt: "asc" },
      take: this.queueRecoveryBatchSize(),
    });

    const retryJobIds: string[] = [];
    const remoteCleanups = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
    };
    let recovered = 0;

    for (const job of staleJobs) {
      const result = await this.recoverStaleRunningJob(job, now);
      if (!result.recovered) continue;

      recovered += 1;
      if (result.remoteCleanup?.attempted) {
        remoteCleanups.attempted += 1;
        if (result.remoteCleanup.succeeded) {
          remoteCleanups.succeeded += 1;
        } else {
          remoteCleanups.failed += 1;
        }
      }
      if (result.retryJobId) {
        retryJobIds.push(result.retryJobId);
      }
      await this.auditService.writeExecutionJobAudit({
        job,
        actorId,
        action: "server_execution_job.recover_stale",
        risk: "medium",
        status: "completed",
        summary: `恢复 stale Server executor job ${job.operationKey}`,
        metadata: {
          statusBefore: "running",
          statusAfter: "failed",
          retryJobId: result.retryJobId,
          autoRetryQueued: Boolean(result.retryJobId),
          remoteCleanup: result.remoteCleanup,
          lockOwner: job.lockOwner,
          lockExpiresAt: job.lockExpiresAt?.toISOString(),
        },
      });
    }

    return { recovered, retryJobIds, remoteCleanups };
  }

  private async recoverStaleRunningJob(job: StaleRunningJob, now: Date) {
    const reason = `Server executor job lock expired at ${job.lockExpiresAt?.toISOString() || "unknown"} from ${job.lockOwner || "unknown worker"}`;
    const updated = await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: job.id,
        status: "running",
        lockExpiresAt: { lte: now },
      },
      data: {
        status: "failed",
        error: "Server executor job lock expired; marked stale for recovery",
        recoveryReason: reason,
        recoveredAt: now,
        recoveryCount: { increment: 1 },
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return { recovered: false };
    }

    const remoteCleanup = await this.staleRemoteCleanupService.cleanup(job);

    if (job.attempt >= job.maxAttempts) {
      return { recovered: true, remoteCleanup };
    }

    const input = rehydrateServerExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.id,
      retryAttempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
    });
    const retryJob = await this.jobLifecycleWriteService.enqueueJob(input, {
      retryOfId: job.id,
      attempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
      availableAt: new Date(now.getTime() + this.queueRetryDelayMs()),
      autoRetry: true,
    });

    return { recovered: true, retryJobId: retryJob.id, remoteCleanup };
  }
}
