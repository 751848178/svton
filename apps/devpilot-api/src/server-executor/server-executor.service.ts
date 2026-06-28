import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { LogCollectionIngestionService } from '../log-center/log-collection-ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildDockerStatsMetricSnapshotInputs } from '../resource-control/metrics/docker-stats-metrics';
import {
  buildSiteTlsProbeCommand,
  extractSiteTlsProbeMetadata,
  mergeSiteTlsProbeMetadata,
} from '../site/site-tls-probe';
import {
  extractSiteTlsRenewMetadata,
  mergeSiteTlsRenewFollowUpProbeMetadata,
  mergeSiteTlsRenewMetadata,
  SiteTlsRenewMetadata,
} from '../site/site-tls-renew';
import { ScriptPlanServerExecutorAdapter } from './adapters/script-plan.adapter';
import { SshLiveServerExecutorAdapter } from './adapters/ssh-live.adapter';
import {
  ListServerExecutionJobsQueryDto,
  ListServerExecutionLeasesQueryDto,
  RetryServerExecutionJobDto,
} from './dto/server-execution-lease.dto';
import { ServerCommandPolicyService } from './server-command-policy.service';
import {
  ServerCommandPolicyResult,
  ServerCommandStep,
  ServerExecutionCancellationToken,
  ServerExecutionInput,
  ServerExecutionMode,
  ServerQueuedExecutionResult,
  ServerExecutionResult,
  ServerExecutorAdapter,
  ServerExecutorTarget,
} from './server-executor.types';

type ServerExecutionLeaseRecord = {
  id: string;
  operationKey: string;
  adapterKey: string;
  acquiredAt: Date;
  expiresAt: Date;
};

type ServerExecutionJobRecord = {
  id: string;
  attempt: number;
};

type MutableCancellationToken = ServerExecutionCancellationToken & {
  cancel(): void;
  checkPersistedCancellation(): Promise<void>;
  stop(): void;
};

type ProcessQueuedJobResult = {
  processed: boolean;
  jobId?: string;
  status?: string;
  retryJobId?: string;
};

type RecoverStaleJobsResult = {
  recovered: number;
  retryJobIds: string[];
};

@Injectable()
export class ServerExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly adapters: ServerExecutorAdapter[];
  private readonly logger = new Logger(ServerExecutorService.name);
  private readonly workerId = `server-executor-${randomUUID()}`;
  private readonly runningCancellations = new Map<string, MutableCancellationToken>();
  private queueTimer?: ReturnType<typeof setInterval>;
  private processingQueue = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sshLiveAdapter: SshLiveServerExecutorAdapter,
    private readonly scriptPlanAdapter: ScriptPlanServerExecutorAdapter,
    private readonly commandPolicy: ServerCommandPolicyService,
    private readonly configService: ConfigService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
  ) {
    this.adapters = [this.sshLiveAdapter, this.scriptPlanAdapter];
  }

  onModuleInit() {
    if (this.configService.get('SERVER_EXECUTOR_QUEUE_WORKER_ENABLED', 'false') !== 'true') {
      return;
    }

    const intervalMs = this.queueWorkerIntervalMs();
    this.queueTimer = setInterval(() => {
      void this.processDueQueuedJobs();
    }, intervalMs);
    this.logger.log(`Server executor queue worker enabled: ${this.workerId}`);
  }

  onModuleDestroy() {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }

    for (const token of this.runningCancellations.values()) {
      token.cancel();
      token.stop();
    }
    this.runningCancellations.clear();
  }

  async resolveTarget(teamId: string, serverId?: string | null): Promise<ServerExecutorTarget> {
    if (!serverId) {
      return { transport: 'none', serverId: null };
    }

    const server = await this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
      },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在或不属于当前团队');
    }

    return {
      transport: 'ssh',
      serverId: server.id,
      serverName: server.name,
      serverHost: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      credentialRef: {
        source: 'server',
        referenceId: server.id,
        displayName: `${server.username}@${server.host}:${server.port}`,
        redacted: true,
      },
    };
  }

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const job = await this.createExecutionJob(input);
    return this.runExecutionWithJob(input, job);
  }

  async queueExecution(
    input: ServerExecutionInput,
    options: {
      maxAttempts?: number;
      availableAt?: Date;
    } = {},
  ): Promise<ServerQueuedExecutionResult> {
    const job = await this.enqueueExecutionJob(input, {
      maxAttempts: options.maxAttempts,
      availableAt: options.availableAt,
    });

    return this.buildQueuedResult(input, {
      id: job.id,
      queuedAt: job.queuedAt,
      availableAt: job.availableAt,
    });
  }

  private async runExecutionWithJob(
    input: ServerExecutionInput,
    job: ServerExecutionJobRecord,
  ): Promise<ServerExecutionResult> {
    let lease: ServerExecutionLeaseRecord | undefined;
    const cancellationToken = this.createCancellationToken(job.id);
    this.runningCancellations.set(job.id, cancellationToken);
    const stopHeartbeat = await this.startJobHeartbeat(job.id);

    try {
      const trackedInput: ServerExecutionInput = {
        ...input,
        metadata: {
          ...(input.metadata || {}),
          serverExecutionJobId: job.id,
        },
        cancellationToken,
      };

      await cancellationToken.checkPersistedCancellation();
      if (cancellationToken.isCancellationRequested()) {
        const result = this.buildCancelledResult(trackedInput);
        await this.finishExecutionJob(job.id, result.status, result);
        await this.syncLinkedBusinessRunAfterExecution(trackedInput, job.id, result);
        return result;
      }

      const policy = await this.commandPolicy.evaluate(trackedInput);
      if (policy.status === 'blocked') {
        const result = this.buildPolicyBlockedResult(trackedInput, policy);
        await this.finishExecutionJob(job.id, result.status, result);
        await this.syncLinkedBusinessRunAfterExecution(trackedInput, job.id, result);
        return result;
      }

      const guardedInput: ServerExecutionInput = {
        ...trackedInput,
        metadata: {
          ...(trackedInput.metadata || {}),
          commandPolicy: policy,
        },
      };
      const adapter = this.resolveAdapter(guardedInput);
      await cancellationToken.checkPersistedCancellation();
      if (cancellationToken.isCancellationRequested()) {
        const result = this.buildCancelledResult(guardedInput);
        await this.finishExecutionJob(job.id, result.status, result);
        await this.syncLinkedBusinessRunAfterExecution(guardedInput, job.id, result);
        return result;
      }

      const leaseAttempt = await this.acquireLiveLease(guardedInput);
      if (leaseAttempt.blocked) {
        await this.finishExecutionJob(job.id, leaseAttempt.blocked.status, leaseAttempt.blocked);
        await this.syncLinkedBusinessRunAfterExecution(guardedInput, job.id, leaseAttempt.blocked);
        return leaseAttempt.blocked;
      }

      lease = leaseAttempt.lease;
      await cancellationToken.checkPersistedCancellation();
      if (cancellationToken.isCancellationRequested()) {
        const result = this.buildCancelledResult(guardedInput);
        await this.releaseLiveLease(lease, result.status);
        await this.finishExecutionJob(job.id, result.status, result);
        await this.syncLinkedBusinessRunAfterExecution(guardedInput, job.id, result);
        return result;
      }

      const leasedInput = lease
        ? {
            ...guardedInput,
            metadata: {
              ...(guardedInput.metadata || {}),
              serverExecutionLeaseId: lease.id,
            },
          }
        : guardedInput;

      const result = await adapter.execute(leasedInput);
      await this.releaseLiveLease(lease, result.status);
      await this.finishExecutionJob(job.id, result.status, result);
      await this.syncLinkedBusinessRunAfterExecution(leasedInput, job.id, result);
      return result;
    } catch (error) {
      await this.releaseLiveLease(lease, 'failed');
      await this.failExecutionJob(job.id, error);
      await this.syncLinkedBusinessRunAfterFailure(input, job.id, error);
      throw error;
    } finally {
      stopHeartbeat();
      cancellationToken.stop();
      this.runningCancellations.delete(job.id);
    }
  }

  async listLeases(teamId: string, query: ListServerExecutionLeasesQueryDto) {
    await this.expireStaleLeases(new Date(), teamId);

    const where: Prisma.ServerExecutionLeaseWhereInput = { teamId };
    if (query.status) where.status = query.status;
    if (query.serverId) where.serverId = query.serverId;
    if (query.operationKey) where.operationKey = query.operationKey;
    if (query.adapterKey) where.adapterKey = query.adapterKey;

    return this.prisma.serverExecutionLease.findMany({
      where,
      orderBy: { acquiredAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        server: { select: { id: true, name: true, host: true, status: true } },
      },
    });
  }

  async expireStaleLeasesForTeam(teamId: string) {
    const result = await this.expireStaleLeases(new Date(), teamId);
    return { expired: result.count };
  }

  async listJobs(teamId: string, query: ListServerExecutionJobsQueryDto) {
    const where: Prisma.ServerExecutionJobWhereInput = { teamId };
    if (query.status) where.status = query.status;
    if (query.serverId) where.serverId = query.serverId;
    if (query.operationKey) where.operationKey = query.operationKey;
    if (query.adapterKey) where.adapterKey = query.adapterKey;
    if (query.queueMode) where.queueMode = query.queueMode;

    return this.prisma.serverExecutionJob.findMany({
      where,
      orderBy: { queuedAt: 'desc' },
      take: 100,
      include: this.jobInclude(),
    });
  }

  async cancelJob(teamId: string, userId: string, id: string) {
    const job = await this.prisma.serverExecutionJob.findFirst({
      where: { id, teamId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        server: { select: { id: true, name: true, host: true, status: true } },
        retryOf: { select: { id: true, status: true, operationKey: true, queuedAt: true } },
        retryAttempts: {
          select: { id: true, status: true, queuedAt: true, finishedAt: true },
          orderBy: { queuedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Server executor 执行任务不存在');
    }

    if (!['queued', 'blocked', 'running'].includes(job.status)) {
      throw new BadRequestException('当前只支持取消 queued/blocked/running 执行任务');
    }

    if (job.status === 'running') {
      const now = new Date();
      const token = this.runningCancellations.get(job.id);

      const updated = await this.prisma.serverExecutionJob.update({
        where: { id: job.id },
        data: {
          cancelRequestedAt: now,
          error: `执行任务已由 ${userId} 请求取消`,
        },
        include: this.jobInclude(),
      });
      token?.cancel();
      return updated;
    }

    return this.prisma.serverExecutionJob.update({
      where: { id: job.id },
      data: {
        status: 'cancelled',
        error: `执行任务已由 ${userId} 取消`,
        cancelRequestedAt: new Date(),
        cancelledAt: new Date(),
        finishedAt: job.finishedAt || new Date(),
      },
      include: this.jobInclude(),
    });
  }

  async retryJob(
    teamId: string,
    userId: string,
    id: string,
    dto: RetryServerExecutionJobDto,
  ) {
    const job = await this.prisma.serverExecutionJob.findFirst({
      where: { id, teamId },
    });

    if (!job) {
      throw new NotFoundException('Server executor 执行任务不存在');
    }

    if (!['failed', 'blocked', 'cancelled'].includes(job.status)) {
      throw new BadRequestException('只有 failed/blocked/cancelled 执行任务可以重试');
    }

    const maxAttempts = Math.max(dto.maxAttempts || job.maxAttempts, job.attempt + 1);
    const input = this.rehydrateExecutionInput(job.inputSnapshot, {
      teamId,
      userId,
      retryOfJobId: job.id,
      retryAttempt: job.attempt + 1,
      maxAttempts,
      dryRun: dto.dryRun,
      confirmationText: dto.confirmationText,
    });

    if (dto.queue !== false) {
      return this.enqueueExecutionJob(input, {
        retryOfId: job.id,
        attempt: job.attempt + 1,
        maxAttempts,
      });
    }

    return this.execute(input);
  }

  async processNextQueuedJob(teamId?: string): Promise<ProcessQueuedJobResult> {
    await this.recoverStaleRunningJobs(teamId);

    const job = await this.claimNextQueuedJob(teamId);
    if (!job) {
      return { processed: false };
    }

    const input = this.rehydrateExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.retryOfId || undefined,
      retryAttempt: job.attempt,
      maxAttempts: job.maxAttempts,
    });
    const result = await this.runExecutionWithJob(input, {
      id: job.id,
      attempt: job.attempt,
    });
    const retryJob = await this.enqueueAutoRetryIfNeeded(job, result);

    return {
      processed: true,
      jobId: job.id,
      status: result.status,
      retryJobId: retryJob?.id,
    };
  }

  async recoverStaleRunningJobs(teamId?: string): Promise<RecoverStaleJobsResult> {
    const now = new Date();
    const staleJobs = await this.prisma.serverExecutionJob.findMany({
      where: {
        teamId,
        status: 'running',
        lockExpiresAt: { lte: now },
      },
      orderBy: { lockExpiresAt: 'asc' },
      take: this.queueRecoveryBatchSize(),
    });

    const retryJobIds: string[] = [];
    let recovered = 0;

    for (const job of staleJobs) {
      const result = await this.recoverStaleRunningJob(job, now);
      if (!result.recovered) continue;

      recovered += 1;
      if (result.retryJobId) {
        retryJobIds.push(result.retryJobId);
      }
    }

    return { recovered, retryJobIds };
  }

  private async createExecutionJob(input: ServerExecutionInput): Promise<ServerExecutionJobRecord> {
    const metadata = this.isRecord(input.metadata) ? input.metadata : {};
    const retryOfId = this.readOptionalString(metadata.retryOfJobId);
    const retryAttempt = this.readPositiveInteger(metadata.retryAttempt) || 1;
    const maxAttempts = Math.max(
      retryAttempt,
      this.readPositiveInteger(metadata.maxAttempts) || retryAttempt,
    );
    const now = new Date();

    return this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        actorId: input.userId ?? undefined,
        serverId: input.target.serverId || undefined,
        retryOfId: retryOfId || undefined,
        operationKey: input.operationKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        dryRun: input.dryRun,
        status: 'running',
        queueMode: 'inline',
        attempt: retryAttempt,
        maxAttempts,
        availableAt: now,
        lockedAt: now,
        lockOwner: this.workerId,
        lockExpiresAt: this.lockExpiresAt(now),
        lastHeartbeatAt: now,
        inputSnapshot: this.buildInputSnapshot(input),
        metadata: this.toJsonValue({
          queueMode: 'inline',
          retryOfJobId: retryOfId,
          retryAttempt,
          maxAttempts,
          sourceMetadata: input.metadata || {},
        }),
        startedAt: now,
      },
      select: { id: true, attempt: true },
    });
  }

  private async enqueueExecutionJob(
    input: ServerExecutionInput,
    options: {
      retryOfId?: string;
      attempt?: number;
      maxAttempts?: number;
      availableAt?: Date;
      autoRetry?: boolean;
    } = {},
  ) {
    const attempt = options.attempt || 1;
    const maxAttempts = Math.max(options.maxAttempts || attempt, attempt);
    const retryOfId = options.retryOfId || this.readOptionalString(input.metadata?.retryOfJobId);

    return this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        actorId: input.userId ?? undefined,
        serverId: input.target.serverId || undefined,
        retryOfId: retryOfId || undefined,
        operationKey: input.operationKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        dryRun: input.dryRun,
        status: 'queued',
        queueMode: 'queued',
        attempt,
        maxAttempts,
        availableAt: options.availableAt || new Date(),
        inputSnapshot: this.buildInputSnapshot({
          ...input,
          metadata: {
            ...(input.metadata || {}),
            retryOfJobId: retryOfId,
            retryAttempt: attempt,
            maxAttempts,
          },
        }),
        metadata: this.toJsonValue({
          queueMode: 'queued',
          retryOfJobId: retryOfId,
          retryAttempt: attempt,
          maxAttempts,
          autoRetry: options.autoRetry || false,
          sourceMetadata: input.metadata || {},
        }),
      },
      include: this.jobInclude(),
    });
  }

  private async claimNextQueuedJob(teamId?: string) {
    const now = new Date();
    const job = await this.prisma.serverExecutionJob.findFirst({
      where: {
        teamId,
        status: 'queued',
        queueMode: 'queued',
        availableAt: { lte: now },
      },
      orderBy: [
        { priority: 'desc' },
        { queuedAt: 'asc' },
      ],
    });

    if (!job) return null;

    const claimed = await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: job.id,
        status: 'queued',
      },
      data: {
        status: 'running',
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

  private async enqueueAutoRetryIfNeeded(
    job: {
      id: string;
      teamId: string;
      actorId: string | null;
      retryOfId: string | null;
      attempt: number;
      maxAttempts: number;
      inputSnapshot: Prisma.JsonValue;
    },
    result: ServerExecutionResult,
  ) {
    if (!['failed', 'blocked'].includes(result.status)) {
      return null;
    }

    if (job.attempt >= job.maxAttempts) {
      return null;
    }

    const input = this.rehydrateExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.id,
      retryAttempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
    });

    return this.enqueueExecutionJob(input, {
      retryOfId: job.id,
      attempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
      availableAt: new Date(Date.now() + this.queueRetryDelayMs()),
      autoRetry: true,
    });
  }

  private async recoverStaleRunningJob(
    job: {
      id: string;
      teamId: string;
      actorId: string | null;
      attempt: number;
      maxAttempts: number;
      inputSnapshot: Prisma.JsonValue;
      lockOwner: string | null;
      lockExpiresAt: Date | null;
    },
    now: Date,
  ) {
    const reason = `Server executor job lock expired at ${job.lockExpiresAt?.toISOString() || 'unknown'} from ${job.lockOwner || 'unknown worker'}`;
    const updated = await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: job.id,
        status: 'running',
        lockExpiresAt: { lte: now },
      },
      data: {
        status: 'failed',
        error: 'Server executor job lock expired; marked stale for recovery',
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

    if (job.attempt >= job.maxAttempts) {
      return { recovered: true };
    }

    const input = this.rehydrateExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.id,
      retryAttempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
    });
    const retryJob = await this.enqueueExecutionJob(input, {
      retryOfId: job.id,
      attempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
      availableAt: new Date(now.getTime() + this.queueRetryDelayMs()),
      autoRetry: true,
    });

    return { recovered: true, retryJobId: retryJob.id };
  }

  private async processDueQueuedJobs() {
    if (this.processingQueue) return;

    this.processingQueue = true;
    try {
      const batchSize = this.queueWorkerBatchSize();
      for (let index = 0; index < batchSize; index += 1) {
        const result = await this.processNextQueuedJob();
        if (!result.processed) break;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Server executor queue worker failed',
      );
    } finally {
      this.processingQueue = false;
    }
  }

  private async finishExecutionJob(
    jobId: string,
    status: ServerExecutionResult['status'],
    result: ServerExecutionResult,
  ) {
    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId },
      data: {
        status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
        finishedAt: new Date(),
      },
    });
  }

  private async failExecutionJob(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Server executor 执行异常';

    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: message,
        logs: this.toJsonValue([{ level: 'error', message }]),
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        finishedAt: new Date(),
      },
    });
  }

  private buildCancelledResult(input: ServerExecutionInput): ServerExecutionResult {
    const warning = 'Server executor 执行已取消';

    return {
      status: 'cancelled',
      mode: 'cancelled',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: false,
      warnings: [...(input.warnings || []), warning],
      commandSteps: input.steps,
      commandPlan: this.toJsonValue({
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        operationKey: input.operationKey,
        dryRun: input.dryRun,
        executable: false,
        target: this.buildTargetMetadata(input),
        safety: {
          cancellationRequested: true,
          cancellationSignal: 'serverExecutionJob.cancelRequestedAt',
        },
        steps: input.steps,
      }),
      logs: this.toJsonValue([{ level: 'warn', message: warning }]),
      result: this.toJsonValue({
        mode: 'cancelled',
        executed: false,
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        cancellationSignal: 'serverExecutionJob.cancelRequestedAt',
      }),
      error: warning,
    };
  }

  private buildQueuedResult(
    input: ServerExecutionInput,
    job: {
      id: string;
      queuedAt: Date;
      availableAt: Date;
    },
  ): ServerQueuedExecutionResult {
    const warning = 'Server executor 执行已加入队列';

    return {
      status: 'queued',
      mode: 'queued',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: true,
      warnings: [...(input.warnings || []), warning],
      commandSteps: input.steps,
      commandPlan: this.toJsonValue({
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        operationKey: input.operationKey,
        dryRun: input.dryRun,
        executable: true,
        target: this.buildTargetMetadata(input),
        queue: {
          mode: 'queued',
          serverExecutionJobId: job.id,
          queuedAt: job.queuedAt.toISOString(),
          availableAt: job.availableAt.toISOString(),
        },
        safety: {
          queuedBeforeExecution: true,
          commandPolicyEvaluatesWhenClaimed: true,
          liveLeaseAcquiresWhenClaimed: true,
        },
        warnings: [...(input.warnings || []), warning],
        metadata: input.metadata || {},
        steps: input.steps,
      }),
      logs: this.toJsonValue([{ level: 'info', message: warning }]),
      result: this.toJsonValue({
        mode: 'queued',
        executed: false,
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        serverExecutionJobId: job.id,
        queuedAt: job.queuedAt.toISOString(),
        availableAt: job.availableAt.toISOString(),
      }),
      serverExecutionJobId: job.id,
      queuedAt: job.queuedAt.toISOString(),
      availableAt: job.availableAt.toISOString(),
      queueMode: 'queued',
    };
  }

  private async syncLinkedBusinessRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
  ) {
    const metadata = this.isRecord(input.metadata) ? input.metadata : {};
    const businessRunSync = this.readOptionalString(metadata.businessRunSync);

    if (businessRunSync === 'deployment') {
      await this.syncDeploymentRunAfterExecution(input, jobId, result, metadata);
      return;
    }

    if (businessRunSync === 'site_sync') {
      await this.syncSiteRunAfterExecution(input, jobId, result, metadata);
      return;
    }

    if (businessRunSync === 'resource_action') {
      await this.syncResourceActionRunAfterExecution(input, jobId, result, metadata);
      return;
    }

    if (businessRunSync === 'service_operation') {
      await this.syncServiceOperationRunAfterExecution(input, jobId, result, metadata);
      return;
    }

    if (businessRunSync === 'backup_run') {
      await this.syncBackupRunAfterExecution(input, jobId, result, metadata);
      return;
    }

    if (businessRunSync === 'log_collection') {
      await this.syncLogCollectionRunAfterExecution(input, jobId, result, metadata);
    }
  }

  private async syncDeploymentRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const deploymentRunId = this.readOptionalString(metadata.deploymentRunId);
    if (!deploymentRunId) {
      return;
    }

    const updated = await this.prisma.deploymentRun.updateMany({
      where: { id: deploymentRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
        finishedAt: new Date(),
      },
    });

    if (updated.count > 0 && result.status !== 'blocked') {
      await this.consumeLinkedApproval(input.teamId, metadata);
    }
  }

  private async syncSiteRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const siteSyncRunId = this.readOptionalString(metadata.siteSyncRunId);
    if (!siteSyncRunId) {
      return;
    }

    const now = new Date();
    const updated = await this.prisma.siteSyncRun.updateMany({
      where: { id: siteSyncRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        executorKey: result.executorKey,
        adapterKey: result.adapterKey,
        commandPlan: this.toJsonValue(result.commandSteps),
        executionPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        warnings: this.toJsonValue(result.warnings),
        error: result.error ?? null,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return;
    }

    const siteId = this.readOptionalString(metadata.siteId);
    if (siteId) {
      const mode = this.readOptionalString(metadata.mode);
      if (!input.dryRun) {
        if (mode === 'sync' || mode === 'rollback') {
          await this.prisma.site.updateMany({
            where: { id: siteId, teamId: input.teamId },
            data: {
              status: result.status === 'completed' ? 'active' : 'error',
              lastSyncAt: now,
              syncError: result.status === 'completed'
                ? null
              : result.error || '站点同步执行未完成',
            },
          });
        }
        if (mode === 'tls_probe' && result.status === 'completed') {
          await this.refreshSiteTlsMetadataAfterProbe(input.teamId, siteId, result, metadata);
        }
      }
      if (mode === 'tls_renew' && (result.status === 'completed' || result.status === 'failed')) {
        const renewal = await this.refreshSiteTlsMetadataAfterRenew(
          input.teamId,
          siteId,
          input.dryRun,
          result,
          metadata,
        );
        if (!input.dryRun && result.status === 'completed' && renewal?.succeeded) {
          await this.queueSiteTlsProbeAfterRenewal(input, siteId, metadata);
        }
      }
    }

    if (result.status !== 'blocked') {
      await this.consumeLinkedApproval(input.teamId, metadata);
    }
  }

  private async refreshSiteTlsMetadataAfterProbe(
    teamId: string,
    siteId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId },
      select: {
        id: true,
        tls: true,
        primaryDomain: true,
      },
    });

    if (!site) {
      return;
    }

    const currentTls = this.isRecord(site.tls) ? site.tls : {};
    const probe = extractSiteTlsProbeMetadata({
      host: this.readOptionalString(metadata.tlsProbeHost) || site.primaryDomain,
      port: this.readPositiveInteger(metadata.tlsProbePort) || 443,
      result: result.result,
      logs: result.logs,
      currentType: this.readOptionalString(currentTls.type),
    });

    if (!probe) {
      return;
    }

    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: {
        tls: mergeSiteTlsProbeMetadata(site.tls, probe),
      },
    });
  }

  private async refreshSiteTlsMetadataAfterRenew(
    teamId: string,
    siteId: string,
    dryRun: boolean,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ): Promise<SiteTlsRenewMetadata | null> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId },
      select: {
        id: true,
        tls: true,
      },
    });

    if (!site) {
      return null;
    }

    const renewal = extractSiteTlsRenewMetadata({
      result: result.result,
      logs: result.logs,
      executionStatus: result.status,
      dryRun,
      runId: this.readOptionalString(metadata.siteSyncRunId),
    });

    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: {
        tls: mergeSiteTlsRenewMetadata(site.tls, renewal),
      },
    });

    return renewal;
  }

  private async queueSiteTlsProbeAfterRenewal(
    input: ServerExecutionInput,
    siteId: string,
    metadata: Record<string, unknown>,
  ) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId: input.teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        serverId: true,
        primaryDomain: true,
        runtimeType: true,
        tls: true,
      },
    });

    if (!site) {
      return;
    }

    const sourceRenewalRunId = this.readOptionalString(metadata.siteSyncRunId);
    const queuedAt = new Date();
    const host = site.primaryDomain;
    const warnings = this.siteTlsProbeWarnings(site.serverId, host);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'probe_tls_certificate',
        label: '探测站点 TLS 证书',
        command: this.isSafeProbeHostname(host) ? buildSiteTlsProbeCommand(host, 443) : '',
        preview: `${host}:443`,
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      },
    ];
    let probeRunId: string | undefined;

    try {
      const probeRun = await this.prisma.siteSyncRun.create({
        data: {
          teamId: input.teamId,
          actorId: input.userId ?? undefined,
          siteId: site.id,
          projectId: site.projectId,
          environmentId: site.environmentId,
          serverId: site.serverId,
          sourceRunId: sourceRenewalRunId || undefined,
          mode: 'tls_probe',
          trigger: 'renewal_follow_up_tls_probe',
          executorKey: 'server-executor',
          adapterKey: 'nginx-site-plan',
          dryRun: false,
          status: 'queued',
          targetConfigPath: `tls://${host}:443`,
          nginxConfig: '',
          commandPlan: this.toJsonValue(commandPlan),
          warnings: this.toJsonValue(warnings),
        },
      });
      probeRunId = probeRun.id;

      const queued = await this.queueExecution(
        {
          teamId: input.teamId,
          userId: input.userId,
          operationKey: 'site.tls_probe',
          adapterKey: 'nginx-site-plan',
          dryRun: false,
          target: input.target,
          steps: commandPlan,
          warnings,
          metadata: {
            siteId: site.id,
            siteSyncRunId: probeRun.id,
            projectId: site.projectId,
            environmentId: site.environmentId,
            siteName: site.primaryDomain,
            primaryDomain: site.primaryDomain,
            runtimeType: site.runtimeType,
            configPath: `tls://${host}:443`,
            tlsProbeHost: host,
            tlsProbePort: 443,
            tlsType: this.readOptionalString(this.isRecord(site.tls) ? site.tls.type : undefined),
            mode: 'tls_probe',
            trigger: 'renewal_follow_up_tls_probe',
            sourceRunId: sourceRenewalRunId,
            businessRunSync: 'site_sync',
          },
          blockOnWarnings: true,
        },
        { maxAttempts: 1 },
      );

      await this.prisma.siteSyncRun.update({
        where: { id: probeRun.id },
        data: {
          status: queued.status,
          serverExecutionJobId: queued.serverExecutionJobId,
          executorKey: queued.executorKey,
          adapterKey: queued.adapterKey,
          commandPlan: this.toJsonValue(queued.commandSteps),
          executionPlan: queued.commandPlan,
          logs: queued.logs,
          result: queued.result,
          warnings: this.toJsonValue(queued.warnings),
          error: queued.error ?? null,
        },
      });

      await this.prisma.site.updateMany({
        where: { id: site.id, teamId: input.teamId },
        data: {
          tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
            status: 'queued',
            sourceRenewalRunId,
            siteSyncRunId: probeRun.id,
            serverExecutionJobId: queued.serverExecutionJobId,
            queuedAt: queuedAt.toISOString(),
          }),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TLS renewal follow-up probe queue failed';
      this.logger.warn(`Failed to queue TLS probe after renewal for site ${site.id}: ${message}`);

      if (probeRunId) {
        await this.prisma.siteSyncRun.updateMany({
          where: { id: probeRunId, teamId: input.teamId },
          data: {
            status: 'failed',
            error: message,
            finishedAt: new Date(),
          },
        });
      }

      await this.prisma.site.updateMany({
        where: { id: site.id, teamId: input.teamId },
        data: {
          tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
            status: 'failed',
            sourceRenewalRunId,
            siteSyncRunId: probeRunId,
            failedAt: new Date().toISOString(),
            error: message,
          }),
        },
      });
    }
  }

  private siteTlsProbeWarnings(serverId: string | null, host: string) {
    const warnings: string[] = [];
    if (!serverId) {
      warnings.push('站点未关联服务器，无法通过 Server executor 探测 TLS 证书');
    }
    if (!this.isSafeProbeHostname(host)) {
      warnings.push('站点主域名包含不支持的字符，已阻止自动 TLS 证书探测命令生成');
    }

    return warnings;
  }

  private isSafeProbeHostname(value: string) {
    return /^[A-Za-z0-9.-]+$/.test(value) && value.includes('.') && !value.includes('..');
  }

  private async syncResourceActionRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const resourceActionRunId = this.readOptionalString(metadata.resourceActionRunId);
    if (!resourceActionRunId) {
      return;
    }

    const updated = await this.prisma.resourceActionRun.updateMany({
      where: { id: resourceActionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        result: result.result,
        error: result.error ?? null,
        finishedAt: new Date(),
      },
    });

    if (updated.count > 0) {
      await this.persistDockerMetricSnapshotsFromActionRun(
        input.teamId,
        resourceActionRunId,
        result.result,
        result.logs,
      );
    }

    if (updated.count > 0 && result.status !== 'blocked') {
      await this.consumeLinkedApproval(input.teamId, metadata);
    }
  }

  private async persistDockerMetricSnapshotsFromActionRun(
    teamId: string,
    resourceActionRunId: string,
    result: unknown,
    logs?: unknown,
  ) {
    const actionRun = await this.prisma.resourceActionRun.findFirst({
      where: { id: resourceActionRunId, teamId },
      select: {
        id: true,
        teamId: true,
        resourceId: true,
        action: true,
        dryRun: true,
        status: true,
        resource: {
          select: {
            id: true,
            sourceType: true,
            provider: true,
            kind: true,
            serverId: true,
            projectId: true,
            environmentId: true,
          },
        },
      },
    });

    if (
      !actionRun ||
      actionRun.action !== 'docker.container.stats' ||
      actionRun.dryRun ||
      actionRun.status !== 'completed'
    ) {
      return 0;
    }

    const existingCount = await this.prisma.resourceMetricSnapshot.count({
      where: { teamId, resourceActionRunId },
    });
    if (existingCount > 0) {
      return 0;
    }

    const snapshots = buildDockerStatsMetricSnapshotInputs(
      {
        teamId: actionRun.teamId,
        resourceId: actionRun.resourceId,
        resourceActionRunId: actionRun.id,
        serverId: actionRun.resource.serverId,
        projectId: actionRun.resource.projectId,
        environmentId: actionRun.resource.environmentId,
        sourceType: actionRun.resource.sourceType,
        provider: actionRun.resource.provider,
        kind: actionRun.resource.kind,
      },
      result,
      logs,
    );

    if (snapshots.length === 0) {
      return 0;
    }

    const created = await this.prisma.resourceMetricSnapshot.createMany({
      data: snapshots,
    });
    return created.count;
  }

  private async syncServiceOperationRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const operationRunId =
      this.readOptionalString(metadata.applicationServiceOperationRunId) ||
      this.readOptionalString(metadata.operationRunId);
    if (!operationRunId) {
      return;
    }

    const updated = await this.prisma.applicationServiceOperationRun.updateMany({
      where: { id: operationRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error ?? null,
        finishedAt: new Date(),
      },
    });

    if (updated.count > 0 && result.status !== 'blocked') {
      await this.consumeLinkedApproval(input.teamId, metadata);
    }
  }

  private async syncBackupRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const backupRunId = this.readOptionalString(metadata.backupRunId);
    if (!backupRunId) {
      return;
    }

    const now = new Date();
    const updated = await this.prisma.backupRun.updateMany({
      where: { id: backupRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error ?? null,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return;
    }

    const backupPlanId = this.readOptionalString(metadata.backupPlanId);
    if (backupPlanId) {
      await this.prisma.backupPlan.updateMany({
        where: { id: backupPlanId, teamId: input.teamId },
        data: {
          lastRunAt: now,
          lastStatus: result.status,
        },
      });
    }
  }

  private async syncLogCollectionRunAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId = this.readOptionalString(metadata.logCollectionRunId);
    if (!logCollectionRunId) {
      return;
    }

    await this.prisma.logCollectionRun.updateMany({
      where: { id: logCollectionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        executorKey: result.executorKey,
        adapterKey: result.adapterKey,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error ?? null,
        finishedAt: new Date(),
      },
    });
    if (result.status === 'completed') {
      await this.logCollectionIngestionService.ingestCompletedRun(input.teamId, logCollectionRunId);
    }
  }

  private async syncLinkedBusinessRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
  ) {
    const metadata = this.isRecord(input.metadata) ? input.metadata : {};
    const businessRunSync = this.readOptionalString(metadata.businessRunSync);

    if (businessRunSync === 'deployment') {
      await this.syncDeploymentRunAfterFailure(input, jobId, error, metadata);
      return;
    }

    if (businessRunSync === 'site_sync') {
      await this.syncSiteRunAfterFailure(input, jobId, error, metadata);
      return;
    }

    if (businessRunSync === 'resource_action') {
      await this.syncResourceActionRunAfterFailure(input, jobId, error, metadata);
      return;
    }

    if (businessRunSync === 'service_operation') {
      await this.syncServiceOperationRunAfterFailure(input, jobId, error, metadata);
      return;
    }

    if (businessRunSync === 'backup_run') {
      await this.syncBackupRunAfterFailure(input, jobId, error, metadata);
      return;
    }

    if (businessRunSync === 'log_collection') {
      await this.syncLogCollectionRunAfterFailure(input, jobId, error, metadata);
    }
  }

  private async syncDeploymentRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const deploymentRunId = this.readOptionalString(metadata.deploymentRunId);
    if (!deploymentRunId) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    await this.prisma.deploymentRun.updateMany({
      where: { id: deploymentRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: new Date(),
      },
    });
  }

  private async syncSiteRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const siteSyncRunId = this.readOptionalString(metadata.siteSyncRunId);
    if (!siteSyncRunId) {
      return;
    }

    const now = new Date();
    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    const updated = await this.prisma.siteSyncRun.updateMany({
      where: { id: siteSyncRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: now,
      },
    });

    if (updated.count === 0 || input.dryRun) {
      return;
    }

    const siteId = this.readOptionalString(metadata.siteId);
    const mode = this.readOptionalString(metadata.mode);
    if (siteId && (mode === 'sync' || mode === 'rollback')) {
      await this.prisma.site.updateMany({
        where: { id: siteId, teamId: input.teamId },
        data: {
          status: 'error',
          lastSyncAt: now,
          syncError: message,
        },
      });
    }
  }

  private async syncResourceActionRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const resourceActionRunId = this.readOptionalString(metadata.resourceActionRunId);
    if (!resourceActionRunId) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    await this.prisma.resourceActionRun.updateMany({
      where: { id: resourceActionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: new Date(),
      },
    });
  }

  private async syncServiceOperationRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const operationRunId =
      this.readOptionalString(metadata.applicationServiceOperationRunId) ||
      this.readOptionalString(metadata.operationRunId);
    if (!operationRunId) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    await this.prisma.applicationServiceOperationRun.updateMany({
      where: { id: operationRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: new Date(),
      },
    });
  }

  private async syncBackupRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const backupRunId = this.readOptionalString(metadata.backupRunId);
    if (!backupRunId) {
      return;
    }

    const now = new Date();
    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    const updated = await this.prisma.backupRun.updateMany({
      where: { id: backupRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return;
    }

    const backupPlanId = this.readOptionalString(metadata.backupPlanId);
    if (backupPlanId) {
      await this.prisma.backupPlan.updateMany({
        where: { id: backupPlanId, teamId: input.teamId },
        data: {
          lastRunAt: now,
          lastStatus: 'failed',
        },
      });
    }
  }

  private async syncLogCollectionRunAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId = this.readOptionalString(metadata.logCollectionRunId);
    if (!logCollectionRunId) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Server executor 执行异常';
    await this.prisma.logCollectionRun.updateMany({
      where: { id: logCollectionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'execution_exception',
          executed: false,
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          serverExecutionJobId: jobId,
        }),
        error: message,
        finishedAt: new Date(),
      },
    });
  }

  private async consumeLinkedApproval(teamId: string, metadata: Record<string, unknown>) {
    const approvalId = this.readOptionalString(metadata.operationApprovalId);
    if (!approvalId) {
      return;
    }

    await this.prisma.operationApproval.updateMany({
      where: {
        id: approvalId,
        teamId,
        status: 'approved',
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }

  private buildInputSnapshot(input: ServerExecutionInput): Prisma.InputJsonValue {
    return this.toJsonValue({
      operationKey: input.operationKey,
      adapterKey: input.adapterKey,
      dryRun: input.dryRun,
      target: input.target,
      steps: input.steps,
      warnings: input.warnings || [],
      metadata: input.metadata || {},
      blockOnWarnings: input.blockOnWarnings,
      requiredConfirmationText: input.requiredConfirmationText,
      confirmationText: input.confirmationText,
    });
  }

  private rehydrateExecutionInput(
    snapshot: Prisma.JsonValue,
    options: {
      teamId: string;
      userId?: string;
      retryOfJobId?: string;
      retryAttempt?: number;
      maxAttempts?: number;
      dryRun?: boolean;
      confirmationText?: string;
    },
  ): ServerExecutionInput {
    if (!this.isRecord(snapshot)) {
      throw new BadRequestException('Server executor 执行快照无效');
    }

    const metadata = this.isRecord(snapshot.metadata) ? snapshot.metadata : {};

    return {
      teamId: options.teamId,
      userId: options.userId,
      operationKey: this.readRequiredString(snapshot.operationKey, 'operationKey'),
      adapterKey: this.readRequiredString(snapshot.adapterKey, 'adapterKey'),
      dryRun: options.dryRun ?? this.readBoolean(snapshot.dryRun),
      target: this.readTargetSnapshot(snapshot.target),
      steps: this.readCommandStepsSnapshot(snapshot.steps),
      warnings: this.readStringArray(snapshot.warnings),
      metadata: {
        ...metadata,
        ...(options.retryOfJobId ? { retryOfJobId: options.retryOfJobId } : {}),
        ...(options.userId ? { retryRequestedBy: options.userId } : {}),
        ...(options.retryAttempt ? { retryAttempt: options.retryAttempt } : {}),
        ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
      },
      blockOnWarnings: this.readOptionalBoolean(snapshot.blockOnWarnings),
      requiredConfirmationText: this.readOptionalString(snapshot.requiredConfirmationText),
      confirmationText:
        options.confirmationText ?? this.readOptionalString(snapshot.confirmationText),
    };
  }

  private readTargetSnapshot(value: unknown): ServerExecutorTarget {
    if (!this.isRecord(value)) {
      throw new BadRequestException('Server executor target 快照无效');
    }

    const transport = this.readRequiredString(value.transport, 'target.transport');
    if (!['ssh', 'server_agent', 'none'].includes(transport)) {
      throw new BadRequestException('Server executor target transport 快照无效');
    }

    return {
      transport: transport as ServerExecutorTarget['transport'],
      serverId: this.readOptionalString(value.serverId),
      serverName: this.readOptionalString(value.serverName),
      serverHost: this.readOptionalString(value.serverHost),
      port: this.readOptionalNumber(value.port),
      username: this.readOptionalString(value.username),
      authType: this.readOptionalString(value.authType),
      credentialRef: this.readCredentialRefSnapshot(value.credentialRef),
    };
  }

  private readCredentialRefSnapshot(value: unknown): ServerExecutorTarget['credentialRef'] {
    if (!this.isRecord(value)) return undefined;

    const source = this.readOptionalString(value.source);
    const referenceId = this.readOptionalString(value.referenceId);
    const displayName = this.readOptionalString(value.displayName);
    if (source !== 'server' || !referenceId || !displayName) return undefined;

    return {
      source,
      referenceId,
      displayName,
      redacted: true,
    };
  }

  private readCommandStepsSnapshot(value: unknown): ServerCommandStep[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('Server executor steps 快照无效');
    }

    return value.map((item, index) => {
      if (!this.isRecord(item)) {
        throw new BadRequestException(`Server executor step ${index + 1} 快照无效`);
      }

      const risk = this.readOptionalString(item.risk);

      return {
        key: this.readRequiredString(item.key, `steps.${index}.key`),
        label: this.readRequiredString(item.label, `steps.${index}.label`),
        command: this.readRequiredString(item.command, `steps.${index}.command`),
        cwd: this.readOptionalString(item.cwd),
        required: typeof item.required === 'boolean' ? item.required : true,
        risk: risk === 'low' || risk === 'medium' || risk === 'high' ? risk : undefined,
        timeoutSeconds: this.readOptionalNumber(item.timeoutSeconds),
        preview: this.readOptionalString(item.preview),
      };
    });
  }

  private resolveAdapter(input: ServerExecutionInput) {
    const adapter = this.adapters.find((candidate) => candidate.supports(input));
    if (!adapter) {
      throw new NotFoundException(
        `没有可用的 Server executor adapter: ${input.target.transport}`,
      );
    }
    return adapter;
  }

  private buildPolicyBlockedResult(
    input: ServerExecutionInput,
    policy: ServerCommandPolicyResult,
  ) {
    const mode: ServerExecutionMode = input.dryRun ? 'dry_run' : 'blocked_live_execution';
    const warnings = [...(input.warnings || []), ...policy.warnings];
    const error = `Server executor 命令策略阻断: ${policy.blockedReasons.join('；')}`;

    return {
      status: 'blocked' as const,
      mode,
      executorKey: 'server-executor' as const,
      adapterKey: input.adapterKey,
      executable: false,
      warnings,
      commandSteps: input.steps,
      commandPlan: this.buildPolicyCommandPlan(input, policy, warnings),
      logs: this.toJsonValue([
        {
          level: 'warn',
          message: error,
        },
      ]),
      result: this.toJsonValue({
        mode,
        executed: false,
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        commandPolicy: policy,
      }),
      error,
    };
  }

  private buildPolicyCommandPlan(
    input: ServerExecutionInput,
    policy: ServerCommandPolicyResult,
    warnings: string[],
  ): Prisma.InputJsonValue {
    return this.toJsonValue({
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable: false,
      target: {
        serverId: input.target.serverId,
        serverName: input.target.serverName,
        serverHost: input.target.serverHost,
        port: input.target.port,
        username: input.target.username,
        authType: input.target.authType,
        credentialRef: input.target.credentialRef,
      },
      safety: {
        arbitraryShell: false,
        commandSource: 'server_executor_adapter',
        commandPolicy: policy.policyKey,
        liveExecutionDefault: 'blocked_unless_policy_passed',
      },
      warnings,
      metadata: input.metadata || {},
      commandPolicy: policy,
      steps: input.steps,
    });
  }

  private async acquireLiveLease(input: ServerExecutionInput): Promise<{
    lease?: ServerExecutionLeaseRecord;
    blocked?: ServerExecutionResult;
  }> {
    if (input.dryRun || input.target.transport !== 'ssh' || !input.target.serverId) {
      return {};
    }

    const now = new Date();
    await this.expireStaleLeases(now);

    const activeKey = this.liveLeaseActiveKey(input.teamId, input.target.serverId);
    const expiresAt = new Date(now.getTime() + this.leaseTtlMs());

    try {
      const lease = await this.prisma.serverExecutionLease.create({
        data: {
          teamId: input.teamId,
          actorId: input.userId ?? undefined,
          serverId: input.target.serverId,
          activeKey,
          operationKey: input.operationKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          dryRun: input.dryRun,
          status: 'running',
          expiresAt,
          metadata: this.toJsonValue({
            target: this.buildTargetMetadata(input),
            sourceMetadata: input.metadata || {},
            stepCount: input.steps.length,
            commandPolicy: input.metadata?.commandPolicy,
          }),
        },
        select: {
          id: true,
          operationKey: true,
          adapterKey: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });

      return { lease };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const blockingLease = await this.prisma.serverExecutionLease.findFirst({
        where: {
          activeKey,
          status: 'running',
        },
        orderBy: { acquiredAt: 'asc' },
        select: {
          id: true,
          operationKey: true,
          adapterKey: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });
      const blockedLease = await this.prisma.serverExecutionLease.create({
        data: {
          teamId: input.teamId,
          actorId: input.userId ?? undefined,
          serverId: input.target.serverId,
          operationKey: input.operationKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          dryRun: input.dryRun,
          status: 'blocked',
          acquiredAt: now,
          releasedAt: now,
          expiresAt: now,
          metadata: this.toJsonValue({
            blockedByLeaseId: blockingLease?.id,
            blockedByOperationKey: blockingLease?.operationKey,
            target: this.buildTargetMetadata(input),
            sourceMetadata: input.metadata || {},
          }),
        },
        select: { id: true },
      });

      return {
        blocked: this.buildConcurrencyBlockedResult(input, blockingLease, blockedLease.id),
      };
    }
  }

  private async releaseLiveLease(
    lease: ServerExecutionLeaseRecord | undefined,
    status: ServerExecutionResult['status'],
  ) {
    if (!lease) return;

    await this.prisma.serverExecutionLease.updateMany({
      where: {
        id: lease.id,
        status: 'running',
      },
      data: {
        status,
        activeKey: null,
        releasedAt: new Date(),
      },
    });
  }

  private async expireStaleLeases(now: Date, teamId?: string) {
    return this.prisma.serverExecutionLease.updateMany({
      where: {
        teamId,
        status: 'running',
        expiresAt: { lte: now },
      },
      data: {
        status: 'expired',
        activeKey: null,
        releasedAt: now,
      },
    });
  }

  private buildConcurrencyBlockedResult(
    input: ServerExecutionInput,
    blockingLease: ServerExecutionLeaseRecord | null,
    blockedLeaseId: string,
  ): ServerExecutionResult {
    const warning = blockingLease
      ? `目标服务器已有 live 执行正在运行：${blockingLease.operationKey}，请等待释放后重试`
      : '目标服务器已有 live 执行正在运行，请等待释放后重试';
    const warnings = [...(input.warnings || []), warning];

    return {
      status: 'blocked',
      mode: 'blocked_live_execution',
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      executable: false,
      warnings,
      commandSteps: input.steps,
      commandPlan: this.buildConcurrencyCommandPlan(input, blockingLease, blockedLeaseId, warnings),
      logs: this.toJsonValue([
        {
          level: 'warn',
          message: warning,
        },
      ]),
      result: this.toJsonValue({
        mode: 'blocked_server_execution_lease',
        executed: false,
        executorKey: 'server-executor',
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        blockedLeaseId,
        blockingLease,
      }),
      error: warning,
    };
  }

  private buildConcurrencyCommandPlan(
    input: ServerExecutionInput,
    blockingLease: ServerExecutionLeaseRecord | null,
    blockedLeaseId: string,
    warnings: string[],
  ): Prisma.InputJsonValue {
    return this.toJsonValue({
      executorKey: 'server-executor',
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable: false,
      target: this.buildTargetMetadata(input),
      safety: {
        liveExecutionConcurrency: 'one_live_execution_per_server',
        activeLeaseRequired: true,
      },
      serverExecutionLease: {
        mode: 'blocked',
        blockedLeaseId,
        blockingLease,
      },
      warnings,
      metadata: input.metadata || {},
      steps: input.steps,
    });
  }

  private buildTargetMetadata(input: ServerExecutionInput) {
    return {
      serverId: input.target.serverId,
      serverName: input.target.serverName,
      serverHost: input.target.serverHost,
      port: input.target.port,
      username: input.target.username,
      authType: input.target.authType,
      credentialRef: input.target.credentialRef,
    };
  }

  private liveLeaseActiveKey(teamId: string, serverId: string) {
    return `${teamId}:${serverId}`;
  }

  private async startJobHeartbeat(jobId: string) {
    await this.extendJobLock(jobId);

    const timer = setInterval(() => {
      void this.extendJobLock(jobId);
    }, this.queueLockHeartbeatMs());

    return () => {
      clearInterval(timer);
    };
  }

  private async extendJobLock(jobId: string) {
    const now = new Date();
    await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: jobId,
        status: 'running',
      },
      data: {
        lockOwner: this.workerId,
        lastHeartbeatAt: now,
        lockExpiresAt: this.lockExpiresAt(now),
      },
    });
  }

  private jobInclude(): Prisma.ServerExecutionJobInclude {
    return {
      actor: { select: { id: true, name: true, email: true } },
      server: { select: { id: true, name: true, host: true, status: true } },
      retryOf: { select: { id: true, status: true, operationKey: true, queuedAt: true } },
      retryAttempts: {
        select: { id: true, status: true, queuedAt: true, finishedAt: true },
        orderBy: { queuedAt: 'desc' },
        take: 5,
      },
      deploymentRuns: {
        select: { id: true, projectId: true, environmentId: true },
        take: 5,
      },
      siteSyncRuns: {
        select: { id: true, projectId: true, environmentId: true },
        take: 5,
      },
      resourceActionRuns: {
        select: {
          id: true,
          resource: { select: { projectId: true, environmentId: true } },
        },
        take: 5,
      },
      applicationServiceOperationRuns: {
        select: { id: true, projectId: true, environmentId: true },
        take: 5,
      },
      backupRuns: {
        select: { id: true, projectId: true, environmentId: true },
        take: 5,
      },
      logCollectionRuns: {
        select: { id: true, projectId: true, environmentId: true },
        take: 5,
      },
    };
  }

  private createCancellationToken(jobId: string): MutableCancellationToken {
    let requested = false;
    let stopped = false;
    let polling = false;
    let pollErrorLogged = false;
    const callbacks = new Set<() => void>();
    const requestCancel = () => {
      if (requested) return;
      requested = true;
      for (const callback of callbacks) {
        callback();
      }
    };
    const checkPersistedCancellation = async () => {
      if (requested || stopped || polling) return;

      polling = true;
      try {
        const job = await this.prisma.serverExecutionJob.findUnique({
          where: { id: jobId },
          select: {
            status: true,
            cancelRequestedAt: true,
          },
        });

        if (!job || job.status === 'cancelled' || job.cancelRequestedAt) {
          requestCancel();
        }
      } catch (error) {
        if (!pollErrorLogged) {
          this.logger.warn(
            error instanceof Error
              ? `Server executor cancellation poll failed: ${error.message}`
              : 'Server executor cancellation poll failed',
          );
          pollErrorLogged = true;
        }
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(() => {
      void checkPersistedCancellation();
    }, this.cancellationPollMs());

    return {
      isCancellationRequested: () => requested,
      onCancel: (callback) => {
        callbacks.add(callback);
        if (requested) callback();
        return () => {
          callbacks.delete(callback);
        };
      },
      cancel: requestCancel,
      checkPersistedCancellation,
      stop: () => {
        stopped = true;
        clearInterval(timer);
        callbacks.clear();
      },
    };
  }

  private leaseTtlMs() {
    const seconds = Number(this.configService.get('SERVER_EXECUTOR_LEASE_TTL_SECONDS', '1800'));
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 1800;
    return safeSeconds * 1000;
  }

  private queueWorkerIntervalMs() {
    const seconds = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_INTERVAL_SECONDS', '5'));
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
    return safeSeconds * 1000;
  }

  private queueRetryDelayMs() {
    const seconds = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_RETRY_DELAY_SECONDS', '30'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : 30;
    return safeSeconds * 1000;
  }

  private queueLockTtlMs() {
    const seconds = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS', '120'));
    const safeSeconds = Number.isFinite(seconds) && seconds > 10 ? seconds : 120;
    return safeSeconds * 1000;
  }

  private queueLockHeartbeatMs() {
    const configuredSeconds = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_HEARTBEAT_SECONDS', '15'));
    const configuredMs = Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds * 1000
      : 15_000;
    return Math.min(configuredMs, Math.max(5_000, Math.floor(this.queueLockTtlMs() / 3)));
  }

  private cancellationPollMs() {
    const configuredSeconds = Number(this.configService.get('SERVER_EXECUTOR_CANCEL_POLL_SECONDS', '2'));
    const configuredMs = Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds * 1000
      : 2_000;
    return Math.max(500, Math.min(configuredMs, 10_000));
  }

  private lockExpiresAt(now = new Date()) {
    return new Date(now.getTime() + this.queueLockTtlMs());
  }

  private queueWorkerBatchSize() {
    const size = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_BATCH_SIZE', '1'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 10) : 1;
  }

  private queueRecoveryBatchSize() {
    const size = Number(this.configService.get('SERVER_EXECUTOR_QUEUE_RECOVERY_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Server executor 快照缺少 ${field}`);
    }
    return value;
  }

  private readOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : true;
  }

  private readOptionalBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : undefined;
  }

  private readOptionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private readPositiveInteger(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
  }

  private readStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
