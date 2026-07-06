import { PrismaService } from "../prisma/prisma.service";
import { JobQueuePort } from "./queue/job-queue.port";

type CreateServerExecutorJobHeartbeatOptions = {
  jobId: string;
  workerId: string;
  intervalMs: number;
  lockExpiresAt(now: Date): Date;
};

export class ServerExecutorJobHeartbeatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue?: JobQueuePort,
  ) {}

  async start({
    jobId,
    workerId,
    intervalMs,
    lockExpiresAt,
  }: CreateServerExecutorJobHeartbeatOptions) {
    await this.extend(jobId, workerId, lockExpiresAt);

    const timer = setInterval(() => {
      void this.extend(jobId, workerId, lockExpiresAt);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }

  async extend(
    jobId: string,
    workerId: string,
    lockExpiresAt: (now: Date) => Date,
  ) {
    if (this.jobQueue) {
      await this.jobQueue.extendJobLock(jobId);
      return;
    }
    const now = new Date();
    await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: jobId,
        status: "running",
      },
      data: {
        lockOwner: workerId,
        lastHeartbeatAt: now,
        lockExpiresAt: lockExpiresAt(now),
      },
    });
  }
}
