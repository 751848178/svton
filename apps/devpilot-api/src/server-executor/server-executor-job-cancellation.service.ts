import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { buildServerExecutionJobInclude } from "./server-executor-job-include.utils";

type SignalRunningCancellation = (jobId: string) => void;

export class ServerExecutorJobCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ServerExecutorAuditService,
    private readonly signalRunningCancellation: SignalRunningCancellation,
  ) {}

  async cancelJob(teamId: string, userId: string, id: string) {
    const job = await this.readJob(teamId, id);

    if (!job) {
      throw new NotFoundException("Server executor 执行任务不存在");
    }

    if (!["queued", "blocked", "running"].includes(job.status)) {
      throw new BadRequestException(
        "当前只支持取消 queued/blocked/running 执行任务",
      );
    }

    if (job.status === "running") {
      return this.requestRunningCancellation(job, userId);
    }

    return this.cancelWaitingJob(job, userId);
  }

  private async requestRunningCancellation(
    job: Awaited<ReturnType<ServerExecutorJobCancellationService["readJob"]>>,
    userId: string,
  ) {
    if (!job) {
      throw new NotFoundException("Server executor 执行任务不存在");
    }

    const now = new Date();
    const updated = await this.prisma.serverExecutionJob.update({
      where: { id: job.id },
      data: {
        cancelRequestedAt: now,
        error: `执行任务已由 ${userId} 请求取消`,
      },
      include: buildServerExecutionJobInclude(),
    });
    this.signalRunningCancellation(job.id);
    await this.auditService.writeExecutionJobAudit({
      job,
      actorId: userId,
      action: "server_execution_job.cancel.request",
      risk: "medium",
      status: "completed",
      summary: `请求取消 Server executor job ${job.operationKey}`,
      metadata: {
        statusBefore: job.status,
        statusAfter: updated.status,
        cancelRequestedAt: now.toISOString(),
      },
    });
    return updated;
  }

  private async cancelWaitingJob(
    job: Awaited<ReturnType<ServerExecutorJobCancellationService["readJob"]>>,
    userId: string,
  ) {
    if (!job) {
      throw new NotFoundException("Server executor 执行任务不存在");
    }

    const updated = await this.prisma.serverExecutionJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        error: `执行任务已由 ${userId} 取消`,
        cancelRequestedAt: new Date(),
        cancelledAt: new Date(),
        finishedAt: job.finishedAt || new Date(),
      },
      include: buildServerExecutionJobInclude(),
    });
    await this.auditService.writeExecutionJobAudit({
      job,
      actorId: userId,
      action: "server_execution_job.cancel",
      risk: "medium",
      status: "completed",
      summary: `取消 Server executor job ${job.operationKey}`,
      metadata: {
        statusBefore: job.status,
        statusAfter: updated.status,
        cancelRequestedAt: updated.cancelRequestedAt?.toISOString(),
      },
    });
    return updated;
  }

  private readJob(teamId: string, id: string) {
    return this.prisma.serverExecutionJob.findFirst({
      where: { id, teamId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        server: { select: { id: true, name: true, host: true, status: true } },
        retryOf: {
          select: {
            id: true,
            status: true,
            operationKey: true,
            queuedAt: true,
          },
        },
        retryAttempts: {
          select: { id: true, status: true, queuedAt: true, finishedAt: true },
          orderBy: { queuedAt: "desc" },
          take: 5,
        },
      },
    });
  }
}
