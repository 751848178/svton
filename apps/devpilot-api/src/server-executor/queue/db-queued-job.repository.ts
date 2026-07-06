import type { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { ClaimedJob, JobCompletionData, RecoveredJob } from "./job-queue.port";

export class DbQueuedJobRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workerId: string,
    private readonly logger: Pick<Logger, "warn">,
  ) {}

  async claimNextDueJob(teamId?: string): Promise<ClaimedJob | null> {
    const now = new Date();
    const job = await this.prisma.serverExecutionJob.findFirst({
      where: {
        teamId,
        status: "queued",
        queueMode: "queued",
        availableAt: { lte: now },
      },
      orderBy: [{ priority: "desc" }, { queuedAt: "asc" }],
    });

    if (!job) return null;

    const claimed = await this.prisma.serverExecutionJob.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "running",
        lockedAt: now,
        lockOwner: this.workerId,
        lockExpiresAt: this.lockExpiresAt(now),
        lastHeartbeatAt: now,
        startedAt: now,
      },
    });

    if (claimed.count === 0) return null;

    const claimedJob = await this.prisma.serverExecutionJob.findUnique({
      where: { id: job.id },
    });
    if (!claimedJob) return null;

    return {
      id: claimedJob.id,
      teamId: claimedJob.teamId,
      actorId: claimedJob.actorId,
      operationKey: claimedJob.operationKey,
      adapterKey: claimedJob.adapterKey,
      attempt: claimedJob.attempt,
      maxAttempts: claimedJob.maxAttempts,
      retryOfId: claimedJob.retryOfId,
      inputSnapshot: claimedJob.inputSnapshot,
    };
  }

  async extendJobLock(jobId: string): Promise<void> {
    const now = new Date();
    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId, status: "running" },
      data: {
        lockOwner: this.workerId,
        lastHeartbeatAt: now,
        lockExpiresAt: this.lockExpiresAt(now),
      },
    });
  }

  async completeJob(
    jobId: string,
    status: "completed" | "failed" | "cancelled",
    data: JobCompletionData,
  ): Promise<void> {
    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId },
      data: {
        status,
        commandPlan: data.commandPlan,
        logs: data.logs,
        result: data.result,
        error: data.error,
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        cancelledAt: status === "cancelled" ? new Date() : undefined,
        finishedAt: new Date(),
      },
    });
  }

  async recoverStaleJobs(teamId?: string): Promise<RecoveredJob[]> {
    const now = new Date();
    const staleJobs = await this.prisma.serverExecutionJob.findMany({
      where: { teamId, status: "running", lockExpiresAt: { lte: now } },
      orderBy: { lockExpiresAt: "asc" },
      take: this.queueRecoveryBatchSize(),
      select: { id: true, teamId: true, operationKey: true },
    });

    const recovered: RecoveredJob[] = [];
    for (const job of staleJobs) {
      const result = await this.prisma.serverExecutionJob.updateMany({
        where: { id: job.id, status: "running", lockExpiresAt: { lte: now } },
        data: {
          status: "failed",
          error: "job lock expired (worker stalled or crashed)",
          lockedAt: null,
          lockOwner: null,
          lockExpiresAt: null,
          finishedAt: now,
        },
      });
      if (result.count > 0) {
        recovered.push({
          jobId: job.id,
          teamId: job.teamId,
          operationKey: job.operationKey,
        });
      }
    }

    if (recovered.length > 0) {
      this.logger.warn(
        `Recovered ${recovered.length} stale server execution jobs`,
      );
    }
    return recovered;
  }

  private lockExpiresAt(now = new Date()) {
    return new Date(now.getTime() + this.queueLockTtlMs());
  }

  private queueLockTtlMs() {
    const seconds = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS", "120"),
    );
    const safeSeconds =
      Number.isFinite(seconds) && seconds > 10 ? seconds : 120;
    return safeSeconds * 1000;
  }

  private queueRecoveryBatchSize() {
    const size = Number(
      this.configService.get("SERVER_EXECUTOR_QUEUE_RECOVERY_BATCH_SIZE", "50"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 200) : 50;
  }
}
