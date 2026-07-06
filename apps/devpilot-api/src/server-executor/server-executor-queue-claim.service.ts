import { PrismaService } from "../prisma/prisma.service";
import { JobQueuePort } from "./queue/job-queue.port";

export class ServerExecutorQueueClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workerId: string,
    private readonly lockExpiresAt: (now: Date) => Date,
    private readonly jobQueue?: JobQueuePort,
  ) {}

  async claimNextQueuedJob(teamId?: string) {
    if (this.jobQueue) {
      const claimed = await this.jobQueue.claimNextDueJob(teamId);
      if (!claimed) return null;
      return this.prisma.serverExecutionJob.findUnique({
        where: { id: claimed.id },
      });
    }

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
      where: {
        id: job.id,
        status: "queued",
      },
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

    return this.prisma.serverExecutionJob.findUnique({
      where: { id: job.id },
    });
  }
}
