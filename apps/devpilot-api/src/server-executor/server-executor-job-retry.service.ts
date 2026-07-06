import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RetryServerExecutionJobDto } from "./dto/server-execution-lease.dto";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

type ExecuteInlineRetry = (
  input: ServerExecutionInput,
) => Promise<ServerExecutionResult>;

export class ServerExecutorJobRetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService,
    private readonly auditService: ServerExecutorAuditService,
    private readonly executeInlineRetry: ExecuteInlineRetry,
  ) {}

  async retryJob(
    teamId: string,
    userId: string,
    id: string,
    dto: RetryServerExecutionJobDto,
  ) {
    const job = await this.readJob(teamId, id);

    if (!job) {
      throw new NotFoundException("Server executor 执行任务不存在");
    }

    if (!["failed", "blocked", "cancelled"].includes(job.status)) {
      throw new BadRequestException(
        "只有 failed/blocked/cancelled 执行任务可以重试",
      );
    }

    const maxAttempts = Math.max(
      dto.maxAttempts || job.maxAttempts,
      job.attempt + 1,
    );
    const retryAttempt = job.attempt + 1;
    const input = rehydrateServerExecutionInput(job.inputSnapshot, {
      teamId,
      userId,
      retryOfJobId: job.id,
      retryAttempt,
      maxAttempts,
      dryRun: dto.dryRun,
      confirmationText: dto.confirmationText,
    });

    if (dto.queue !== false) {
      return this.enqueueRetry(job, input, userId, retryAttempt, maxAttempts);
    }

    return this.executeInline(job, input, userId, retryAttempt, maxAttempts);
  }

  private async enqueueRetry(
    job: NonNullable<
      Awaited<ReturnType<ServerExecutorJobRetryService["readJob"]>>
    >,
    input: ServerExecutionInput,
    userId: string,
    retryAttempt: number,
    maxAttempts: number,
  ) {
    const retryJob = await this.jobLifecycleWriteService.enqueueJob(input, {
      retryOfId: job.id,
      attempt: retryAttempt,
      maxAttempts,
    });
    await this.auditService.writeExecutionJobAudit({
      job,
      actorId: userId,
      action: "server_execution_job.retry.queue",
      risk: "medium",
      status: "completed",
      summary: `重试 Server executor job ${job.operationKey}`,
      metadata: {
        queue: true,
        statusBefore: job.status,
        retryJobId: retryJob.id,
        retryAttempt,
        maxAttempts,
        dryRun: input.dryRun,
      },
    });
    return retryJob;
  }

  private async executeInline(
    job: NonNullable<
      Awaited<ReturnType<ServerExecutorJobRetryService["readJob"]>>
    >,
    input: ServerExecutionInput,
    userId: string,
    retryAttempt: number,
    maxAttempts: number,
  ) {
    const result = await this.executeInlineRetry(input);
    await this.auditService.writeExecutionJobAudit({
      job,
      actorId: userId,
      action: "server_execution_job.retry.inline",
      risk: input.dryRun ? "low" : "medium",
      status: result.status,
      summary: `立即重试 Server executor job ${job.operationKey} ${result.status}`,
      metadata: {
        queue: false,
        statusBefore: job.status,
        retryAttempt,
        maxAttempts,
        dryRun: input.dryRun,
        resultStatus: result.status,
        resultMode: result.mode,
        error: result.error,
      },
    });
    return result;
  }

  private readJob(teamId: string, id: string) {
    return this.prisma.serverExecutionJob.findFirst({
      where: { id, teamId },
    });
  }
}
