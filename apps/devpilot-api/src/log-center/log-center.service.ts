import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import { ServerCommandStep, ServerExecutionInput } from '../server-executor/server-executor.types';
import { AliyunSlsLogQueryAdapter } from './aliyun-sls-log-query.adapter';
import { LogCollectionIngestionService } from './log-collection-ingestion.service';
import { redactLogMessage, redactLogValue, resolveLogRedactionPolicy } from './log-redaction';
import {
  AppendLogEntriesDto,
  CleanupLogRetentionDto,
  CollectLogStreamDto,
  CreateLogStreamDto,
  ListLogCollectionRunsQueryDto,
  ListLogEntriesQueryDto,
  ListLogRetentionRunsQueryDto,
  ListLogStatsQueryDto,
  ListLogStreamsQueryDto,
  TailLogEntriesQueryDto,
  UpdateLogStreamDto,
} from './dto/log-center.dto';

const logStreamInclude = Prisma.validator<Prisma.LogStreamInclude>()({
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: { select: { id: true, name: true, kind: true, runtime: true, status: true, deployConfig: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true } },
  managedResource: {
    select: {
      id: true,
      name: true,
      sourceType: true,
      provider: true,
      kind: true,
      status: true,
      endpoint: true,
      externalId: true,
      credentialId: true,
      config: true,
      metadata: true,
    },
  },
  deploymentRun: { select: { id: true, source: true, trigger: true, status: true } },
  backupPlan: { select: { id: true, name: true, status: true, lastStatus: true } },
  backupRun: { select: { id: true, backupType: true, status: true, dryRun: true } },
  alertEvent: { select: { id: true, metric: true, severity: true, status: true } },
  _count: { select: { entries: true } },
});

const logEntryInclude = Prisma.validator<Prisma.LogEntryInclude>()({
  stream: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      sourceType: true,
      status: true,
    },
  },
  actor: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: { select: { id: true, name: true, kind: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true } },
  managedResource: {
    select: { id: true, name: true, sourceType: true, provider: true, kind: true, status: true, endpoint: true },
  },
  deploymentRun: { select: { id: true, source: true, trigger: true, status: true } },
  backupPlan: { select: { id: true, name: true, status: true, lastStatus: true } },
  backupRun: { select: { id: true, backupType: true, status: true, dryRun: true } },
  alertEvent: { select: { id: true, metric: true, severity: true, status: true } },
});

const logCollectionRunInclude = Prisma.validator<Prisma.LogCollectionRunInclude>()({
  actor: { select: { id: true, name: true, email: true } },
  stream: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      sourceType: true,
      sourceKey: true,
      status: true,
    },
  },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: { select: { id: true, name: true, kind: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true } },
  managedResource: {
    select: { id: true, name: true, sourceType: true, provider: true, kind: true, status: true, endpoint: true },
  },
  deploymentRun: { select: { id: true, source: true, trigger: true, status: true } },
  backupPlan: { select: { id: true, name: true, status: true, lastStatus: true } },
  backupRun: { select: { id: true, backupType: true, status: true, dryRun: true } },
  alertEvent: { select: { id: true, metric: true, severity: true, status: true } },
  serverExecutionJob: {
    select: {
      id: true,
      status: true,
      queueMode: true,
      attempt: true,
      maxAttempts: true,
      queuedAt: true,
      startedAt: true,
      finishedAt: true,
    },
  },
});

const logRetentionRunInclude = Prisma.validator<Prisma.LogRetentionRunInclude>()({
  actor: { select: { id: true, name: true, email: true } },
  stream: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      sourceType: true,
      status: true,
      retentionDays: true,
    },
  },
});

type LogStreamRecord = Prisma.LogStreamGetPayload<{ include: typeof logStreamInclude }>;
type LogCollectionRunRecord = Prisma.LogCollectionRunGetPayload<{ include: typeof logCollectionRunInclude }>;
type LogRetentionRunRecord = Prisma.LogRetentionRunGetPayload<{ include: typeof logRetentionRunInclude }>;

type TargetContext = {
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  backupPlanId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
  sourceType?: string;
};

type NormalizedLogEntry = {
  level: string;
  message: string;
  timestamp?: Date;
  source?: string;
  labels?: Record<string, unknown>;
  context?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

type CollectionExecutionResult = {
  status: 'queued' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  executorKey: string;
  adapterKey: string;
  serverExecutionJobId?: string;
  commandPlan?: Prisma.InputJsonValue;
  logs?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
};

@Injectable()
export class LogCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventService: AuditEventService,
    private readonly serverExecutorService: ServerExecutorService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
    private readonly aliyunSlsLogQueryAdapter: AliyunSlsLogQueryAdapter,
  ) {}

  async listStreams(teamId: string, query: ListLogStreamsQueryDto) {
    const where: Prisma.LogStreamWhereInput = { teamId };

    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.applicationServiceId) where.applicationServiceId = query.applicationServiceId;
    if (query.serverId) where.serverId = query.serverId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.managedResourceId) where.managedResourceId = query.managedResourceId;

    return this.prisma.logStream.findMany({
      where,
      orderBy: [{ lastEntryAt: 'desc' }, { updatedAt: 'desc' }],
      include: logStreamInclude,
    });
  }

  async listEntries(teamId: string, query: ListLogEntriesQueryDto) {
    const where = this.buildLogEntryWhere(teamId, query);

    return this.prisma.logEntry.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: logEntryInclude,
    });
  }

  async tailStreamEntries(teamId: string, streamId: string, query: TailLogEntriesQueryDto) {
    const stream = await this.getStream(teamId, streamId);
    const limit = this.normalizeTailEntryLimit(query.limit);
    const cursor = this.parseTailCursor(query.cursor);
    const where: Prisma.LogEntryWhereInput = {
      teamId,
      streamId: stream.id,
    };

    if (cursor) {
      where.OR = [
        { timestamp: { gt: cursor.timestamp } },
        {
          timestamp: cursor.timestamp,
          createdAt: { gt: cursor.createdAt },
        },
        {
          timestamp: cursor.timestamp,
          createdAt: cursor.createdAt,
          id: { gt: cursor.id },
        },
      ];
    }

    const entries = await this.prisma.logEntry.findMany({
      where,
      orderBy: cursor
        ? [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
        : [{ timestamp: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: logEntryInclude,
    });
    const orderedEntries = cursor ? entries : [...entries].reverse();
    const latestEntry = orderedEntries[orderedEntries.length - 1];

    return {
      streamId: stream.id,
      limit,
      pollAfterMs: 3000,
      hasMore: entries.length === limit,
      cursor: latestEntry ? this.buildTailCursor(latestEntry.timestamp, latestEntry.createdAt, latestEntry.id) : query.cursor || null,
      entries: orderedEntries,
    };
  }

  async getEntryStats(teamId: string, query: ListLogStatsQueryDto, readableStreamIds: string[]) {
    const windowMinutes = this.normalizeWindowMinutes(query.windowMinutes);
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);

    if (readableStreamIds.length === 0) {
      return this.emptyEntryStats(windowMinutes, from, to);
    }

    const where = this.buildLogEntryWhere(teamId, query);
    where.timestamp = { gte: from, lte: to };
    where.streamId = query.streamId || { in: readableStreamIds };

    const [total, groupedLevels, latestEntry] = await Promise.all([
      this.prisma.logEntry.count({ where }),
      this.prisma.logEntry.groupBy({
        by: ['level'],
        where,
        _count: { _all: true },
      }),
      this.prisma.logEntry.findFirst({
        where,
        orderBy: { timestamp: 'desc' },
        select: { id: true, level: true, message: true, timestamp: true, streamId: true },
      }),
    ]);
    const byLevel = groupedLevels
      .map((item) => ({ level: item.level, count: item._count._all }))
      .sort((left, right) => right.count - left.count || left.level.localeCompare(right.level));
    const countByLevel = Object.fromEntries(byLevel.map((item) => [item.level, item.count]));

    return {
      windowMinutes,
      from,
      to,
      total,
      byLevel,
      countByLevel,
      warningCount: countByLevel.warn || 0,
      errorCount: countByLevel.error || 0,
      fatalCount: countByLevel.fatal || 0,
      latestEntry,
    };
  }

  async listCollectionRuns(teamId: string, query: ListLogCollectionRunsQueryDto) {
    const where: Prisma.LogCollectionRunWhereInput = { teamId };

    if (query.streamId) where.streamId = query.streamId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.logCollectionRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: logCollectionRunInclude,
    });
  }

  async listRetentionRuns(teamId: string, query: ListLogRetentionRunsQueryDto) {
    const where: Prisma.LogRetentionRunWhereInput = { teamId };

    if (query.streamId) where.streamId = query.streamId;
    if (query.status) where.status = query.status;
    if (query.dryRun !== undefined) where.dryRun = query.dryRun;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.logRetentionRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: logRetentionRunInclude,
    });
  }

  async resolveStreamCreateAccessScope(teamId: string, dto: CreateLogStreamDto) {
    const target = await this.resolveTargetContext(teamId, dto);
    return {
      projectId: target.projectId ?? null,
      environmentId: target.environmentId ?? null,
    };
  }

  async getStreamAccessScope(teamId: string, streamId: string) {
    const stream = await this.getStream(teamId, streamId);
    return {
      projectId: stream.projectId,
      environmentId: stream.environmentId,
    };
  }

  async collectStream(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CollectLogStreamDto,
  ) {
    const stream = await this.getStream(teamId, streamId);

    if (stream.status === 'archived') {
      throw new BadRequestException('归档的日志流不能发起采集');
    }

    const tail = this.normalizeTail(dto.tail);
    const dryRun = dto.dryRun ?? true;
    const queue = dto.queue === true && this.isServerCollectableSource(stream.sourceType);
    const run = await this.prisma.logCollectionRun.create({
      data: {
        teamId,
        streamId: stream.id,
        actorId: userId ?? undefined,
        projectId: stream.projectId,
        environmentId: stream.environmentId,
        applicationId: stream.applicationId,
        applicationServiceId: stream.applicationServiceId,
        serverId: stream.serverId,
        siteId: stream.siteId,
        managedResourceId: stream.managedResourceId,
        deploymentRunId: stream.deploymentRunId,
        backupPlanId: stream.backupPlanId,
        backupRunId: stream.backupRunId,
        alertEventId: stream.alertEventId,
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        dryRun,
        tail,
        status: queue ? 'queued' : undefined,
        params: dto.params ? this.toJsonValue(dto.params) : undefined,
      },
      include: logCollectionRunInclude,
    });

    const execution = await this.executeCollectionPlan(teamId, userId, stream, run.id, {
      dryRun,
      tail,
      queue,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
      params: dto.params,
    });

    const updateData: Prisma.LogCollectionRunUncheckedUpdateInput = {
      executorKey: execution.executorKey,
      adapterKey: execution.adapterKey,
      status: execution.status,
      commandPlan: execution.commandPlan,
      logs: execution.logs,
      result: execution.result,
      error: execution.error,
      ...(execution.serverExecutionJobId ? { serverExecutionJobId: execution.serverExecutionJobId } : {}),
      ...(execution.status === 'queued' ? {} : { finishedAt: new Date() }),
    };
    const updatedRun = await this.prisma.logCollectionRun.update({
      where: { id: run.id },
      data: updateData,
      include: logCollectionRunInclude,
    });

    if (execution.status === 'completed') {
      await this.logCollectionIngestionService.ingestCompletedRun(teamId, run.id);
    }
    const finalRun = await this.prisma.logCollectionRun.findFirst({
      where: { id: run.id, teamId },
      include: logCollectionRunInclude,
    });

    await this.writeCollectionAudit(teamId, userId, stream, finalRun || updatedRun);
    return finalRun || updatedRun;
  }

  async createStream(teamId: string, userId: string, dto: CreateLogStreamDto) {
    const target = await this.resolveTargetContext(teamId, dto);

    return this.prisma.logStream.create({
      data: {
        teamId,
        createdById: userId,
        ...this.stripSourceType(target),
        name: dto.name,
        sourceType: dto.sourceType || target.sourceType || 'manual',
        sourceKey: dto.sourceKey,
        retentionDays: dto.retentionDays || 14,
        labels: dto.labels ? this.toJsonValue(dto.labels) : undefined,
        metadata: dto.metadata ? this.toJsonValue(dto.metadata) : undefined,
      },
      include: logStreamInclude,
    });
  }

  async updateStream(teamId: string, streamId: string, dto: UpdateLogStreamDto) {
    const stream = await this.getStream(teamId, streamId);
    const data: Prisma.LogStreamUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.retentionDays !== undefined) data.retentionDays = dto.retentionDays;
    if (dto.labels !== undefined) data.labels = this.toJsonValue(dto.labels);
    if (dto.metadata !== undefined) data.metadata = this.toJsonValue(dto.metadata);

    return this.prisma.logStream.update({
      where: { id: stream.id },
      data,
      include: logStreamInclude,
    });
  }

  async appendEntries(
    teamId: string,
    userId: string,
    streamId: string,
    dto: AppendLogEntriesDto,
  ) {
    const stream = await this.getStream(teamId, streamId);

    if (stream.status === 'archived') {
      throw new BadRequestException('归档的日志流不能追加日志');
    }

    const normalizedEntries = this.normalizeEntries(dto);
    if (normalizedEntries.length === 0) {
      throw new BadRequestException('至少需要追加一条日志');
    }
    if (normalizedEntries.length > 100) {
      throw new BadRequestException('单次最多追加 100 条日志');
    }

    const createdEntries = [];
    const redactionPolicy = resolveLogRedactionPolicy(stream.metadata);
    for (const entry of normalizedEntries) {
      const message = redactLogMessage(entry.message, redactionPolicy);
      const created = await this.prisma.logEntry.create({
        data: {
          teamId,
          streamId: stream.id,
          actorId: userId,
          projectId: stream.projectId,
          environmentId: stream.environmentId,
          applicationId: stream.applicationId,
          applicationServiceId: stream.applicationServiceId,
          serverId: stream.serverId,
          siteId: stream.siteId,
          managedResourceId: stream.managedResourceId,
          deploymentRunId: stream.deploymentRunId,
          backupPlanId: stream.backupPlanId,
          backupRunId: stream.backupRunId,
          alertEventId: stream.alertEventId,
          timestamp: entry.timestamp || new Date(),
          level: entry.level,
          message,
          source: entry.source || stream.sourceType,
          labels: entry.labels ? this.toJsonValue(redactLogValue(entry.labels, redactionPolicy)) : undefined,
          context: entry.context ? this.toJsonValue(redactLogValue(entry.context, redactionPolicy)) : undefined,
          raw: entry.raw ? this.toJsonValue(redactLogValue(entry.raw, redactionPolicy)) : undefined,
        },
        include: logEntryInclude,
      });
      createdEntries.push(created);
    }

    const lastEntry = createdEntries[createdEntries.length - 1];
    const updatedStream = await this.prisma.logStream.update({
      where: { id: stream.id },
      data: {
        lastEntryAt: lastEntry.timestamp,
        lastLevel: lastEntry.level,
        lastMessage: lastEntry.message,
      },
      include: logStreamInclude,
    });

    await this.writeLogAudit(teamId, userId, updatedStream, lastEntry, createdEntries.length);
    return { stream: updatedStream, entries: createdEntries };
  }

  async cleanupRetention(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CleanupLogRetentionDto,
  ) {
    const stream = await this.getStream(teamId, streamId);
    const dryRun = dto.dryRun !== false;
    const retentionDays = Math.max(1, stream.retentionDays || 1);
    const cutoffAt = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const run = await this.prisma.logRetentionRun.create({
      data: {
        teamId,
        streamId: stream.id,
        actorId: userId || undefined,
        projectId: stream.projectId,
        environmentId: stream.environmentId,
        dryRun,
        retentionDays,
        cutoffAt,
      },
      include: logRetentionRunInclude,
    });

    try {
      const where: Prisma.LogEntryWhereInput = {
        teamId,
        streamId: stream.id,
        timestamp: { lt: cutoffAt },
      };
      const matchedEntryCount = await this.prisma.logEntry.count({ where });
      const deletedEntryCount = dryRun
        ? 0
        : (await this.prisma.logEntry.deleteMany({ where })).count;

      if (!dryRun && deletedEntryCount > 0) {
        await this.refreshLogStreamLastEntry(stream.id);
      }

      const completed = await this.prisma.logRetentionRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          matchedEntryCount,
          deletedEntryCount,
          finishedAt: new Date(),
        },
        include: logRetentionRunInclude,
      });
      await this.writeRetentionAudit(teamId, userId, stream, completed);
      return completed;
    } catch (error) {
      const failed = await this.prisma.logRetentionRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '日志保留清理失败',
          finishedAt: new Date(),
        },
        include: logRetentionRunInclude,
      });
      await this.writeRetentionAudit(teamId, userId, stream, failed);
      return failed;
    }
  }

  private async getStream(teamId: string, streamId: string) {
    const stream = await this.prisma.logStream.findFirst({
      where: { id: streamId, teamId },
      include: logStreamInclude,
    });

    if (!stream) {
      throw new NotFoundException('日志流不存在');
    }

    return stream;
  }

  private async executeCollectionPlan(
    teamId: string,
    userId: string | null,
    stream: LogStreamRecord,
    runId: string,
    options: {
      dryRun: boolean;
      tail: number;
      queue?: boolean;
      maxAttempts?: number;
      confirmationText?: string;
      params?: Record<string, unknown>;
    },
  ): Promise<CollectionExecutionResult> {
    if (this.isServerCollectableSource(stream.sourceType)) {
      const { steps, warnings } = this.buildServerCollectionSteps(stream, options.tail);
      const target = await this.serverExecutorService.resolveTarget(teamId, stream.serverId);
      const executionInput: ServerExecutionInput = {
        teamId,
        userId: userId ?? undefined,
        operationKey: `log.collect.${stream.sourceType}`,
        adapterKey: 'log-collection-plan',
        dryRun: options.dryRun,
        target,
        steps,
        warnings,
        blockOnWarnings: true,
        confirmationText: options.confirmationText,
        metadata: {
          logStreamId: stream.id,
          logCollectionRunId: runId,
          ...(options.queue ? { businessRunSync: 'log_collection' } : {}),
          sourceType: stream.sourceType,
          sourceKey: stream.sourceKey,
          params: options.params || {},
        },
      };
      const result = options.queue
        ? await this.serverExecutorService.queueExecution(executionInput, { maxAttempts: options.maxAttempts })
        : await this.serverExecutorService.execute(executionInput);
      const serverExecutionJobId = 'serverExecutionJobId' in result && typeof result.serverExecutionJobId === 'string'
        ? result.serverExecutionJobId
        : undefined;

      return {
        status: this.terminalCollectionStatus(result.status),
        executorKey: result.executorKey,
        adapterKey: result.adapterKey,
        serverExecutionJobId,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
      };
    }

    return this.buildProviderCollectionPlan(stream, runId, options);
  }

  private buildServerCollectionSteps(stream: LogStreamRecord, tail: number) {
    const warnings: string[] = [];
    const steps: ServerCommandStep[] = [];

    if (!stream.serverId) {
      warnings.push('日志流没有绑定服务器，无法通过 Server executor 生成采集命令。');
    }

    if (stream.sourceType === 'docker') {
      const dockerStep = this.buildDockerLogStep(stream, tail);
      if (!dockerStep.command) {
        warnings.push('未找到可用的 Docker 容器名或 Docker Compose 服务名。');
      }
      steps.push(dockerStep);
      return { steps, warnings };
    }

    if (stream.sourceType === 'nginx') {
      const sourcePath = this.normalizeVarLogPath(stream.sourceKey, 'nginx');
      if (sourcePath) {
        steps.push({
          key: 'tail-nginx-source',
          label: '采集 Nginx 指定日志',
          command: `tail -n ${tail} ${sourcePath}`,
          required: true,
          risk: 'low',
          timeoutSeconds: 15,
        });
        return { steps, warnings };
      }

      steps.push(
        {
          key: 'tail-nginx-access',
          label: '采集 Nginx access.log',
          command: `tail -n ${tail} /var/log/nginx/access.log`,
          required: false,
          risk: 'low',
          timeoutSeconds: 15,
        },
        {
          key: 'tail-nginx-error',
          label: '采集 Nginx error.log',
          command: `tail -n ${tail} /var/log/nginx/error.log`,
          required: false,
          risk: 'low',
          timeoutSeconds: 15,
        },
      );
      return { steps, warnings };
    }

    const sourcePath = this.normalizeVarLogPath(stream.sourceKey);
    if (!sourcePath) {
      warnings.push('服务器日志流需要 sourceKey 指向 /var/log 下的 .log 文件。');
    }

    steps.push({
      key: 'tail-var-log',
      label: '采集服务器日志文件',
      command: sourcePath ? `tail -n ${tail} ${sourcePath}` : '',
      required: true,
      risk: 'low',
      timeoutSeconds: 15,
    });

    return { steps, warnings };
  }

  private buildDockerLogStep(stream: LogStreamRecord, tail: number): ServerCommandStep {
    const deployConfig = this.toRecord(stream.applicationService?.deployConfig);
    const resourceConfig = this.toRecord(stream.managedResource?.config);
    const kind = stream.applicationService?.kind || '';
    const composeService = this.firstCommandToken(
      stream.sourceKey,
      deployConfig.serviceName,
      deployConfig.composeService,
      deployConfig.service,
      stream.applicationService?.name,
    );

    if (kind === 'docker-compose' && composeService) {
      return {
        key: 'docker-compose-logs',
        label: '采集 Docker Compose 服务日志',
        command: `docker compose logs --tail=${tail} ${composeService}`,
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      };
    }

    const containerName = this.firstCommandToken(
      stream.sourceKey,
      deployConfig.containerName,
      deployConfig.container,
      resourceConfig.containerName,
      stream.managedResource?.externalId,
      stream.applicationService?.name,
      stream.managedResource?.name,
    );

    return {
      key: 'docker-logs',
      label: '采集 Docker 容器日志',
      command: containerName ? `docker logs --tail=${tail} ${containerName}` : '',
      required: true,
      risk: 'low',
      timeoutSeconds: 20,
    };
  }

  private async buildProviderCollectionPlan(
    stream: LogStreamRecord,
    runId: string,
    options: {
      dryRun: boolean;
      tail: number;
      params?: Record<string, unknown>;
    },
  ): Promise<CollectionExecutionResult> {
    if (stream.sourceType === 'sls') {
      return this.buildSlsCollectionPlan(stream, runId, options);
    }

    const status = 'blocked';
    const adapterKey = `${stream.sourceType}-log-provider-plan`;
    const warnings = [`${stream.sourceType} 日志流暂不支持自动采集。`];
    const error = warnings[0];

    return {
      status,
      executorKey: 'provider-adapter',
      adapterKey,
      commandPlan: this.toJsonValue({
        executorKey: 'provider-adapter',
        adapterKey,
        operationKey: `log.collect.${stream.sourceType}`,
        dryRun: options.dryRun,
        executable: false,
        target: {
          streamId: stream.id,
          managedResourceId: stream.managedResourceId,
          provider: stream.managedResource?.provider,
          sourceType: stream.sourceType,
          sourceKey: stream.sourceKey,
        },
        safety: {
          arbitraryShell: false,
          commandSource: 'provider_adapter',
          liveExecutionDefault: 'blocked_until_credential_adapter_ready',
        },
        warnings,
        metadata: {
          logStreamId: stream.id,
          logCollectionRunId: runId,
          params: options.params || {},
          tail: options.tail,
        },
      }),
      logs: this.toJsonValue([
        {
          level: 'warn',
          message: error,
        },
      ]),
      result: this.toJsonValue({
        mode: 'blocked_unsupported_source',
        executed: false,
        executorKey: 'provider-adapter',
        adapterKey,
        warnings,
        nextExecutorBoundary: 'credential_provider_adapter',
      }),
      error,
    };
  }

  private async buildSlsCollectionPlan(
    stream: LogStreamRecord,
    runId: string,
    options: {
      dryRun: boolean;
      tail: number;
      params?: Record<string, unknown>;
    },
  ): Promise<CollectionExecutionResult> {
    const params = options.params || {};
    const config = this.toRecord(stream.managedResource?.config);
    const metadata = this.toRecord(stream.managedResource?.metadata);
    const logstores = this.readStringArray(config.logstores);
    const project = this.readString(params.project) ||
      this.readString(config.project) ||
      stream.managedResource?.name ||
      'unknown-project';
    const logstore = this.readString(params.logstore) ||
      this.readString(stream.sourceKey) ||
      this.readString(config.logstore) ||
      logstores[0] ||
      'default-logstore';
    const query = this.readString(params.query) || '*';
    const region = this.readString(params.region) || this.readString(metadata.region) || 'default';
    const windowMinutes = this.positiveInt(params.windowMinutes, 15, 1440);
    const limit = this.positiveInt(params.limit, Math.min(options.tail || 100, 100), 1000);
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const liveEnabled = this.aliyunSlsLogQueryAdapter.isLiveEnabled();
    const liveConfirmed = this.isLiveSlsQueryConfirmed(params);
    const adapterKey = options.dryRun ? 'aliyun-sls-query-plan' : this.aliyunSlsLogQueryAdapter.adapterKey;
    const credentialReady = Boolean(stream.managedResource?.credentialId);
    const warnings = [
      ...(!credentialReady ? ['SLS 日志流未绑定 TeamCredential，live 回填会被阻断。'] : []),
      ...(options.dryRun ? [] : [
        ...(!liveEnabled ? ['SLS live 查询未启用，需要 LOG_CENTER_SLS_LIVE_QUERY_ENABLED=true。'] : []),
        ...(!liveConfirmed ? ['SLS live 查询需要 params.confirmLiveRead=true。'] : []),
      ]),
    ];
    const executable = options.dryRun || warnings.length === 0;
    const status = executable ? 'completed' : 'blocked';
    const error = status === 'blocked' ? warnings.join('；') : undefined;
    const sampleLines = [
      `${from.toISOString()} INFO SLS dry-run query="${query}" project=${project} logstore=${logstore}`,
      `${to.toISOString()} INFO SLS live adapter requires explicit confirmation and feature flag`,
    ];
    const commandPlan = this.toJsonValue({
      executorKey: 'cloud-sdk',
      adapterKey,
      operationKey: 'log.collect.sls.query',
      dryRun: options.dryRun,
      executable,
      target: {
        streamId: stream.id,
        managedResourceId: stream.managedResourceId,
        provider: stream.managedResource?.provider || 'aliyun-sls',
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        project,
        logstore,
        region,
      },
      query: {
        type: 'sls_query',
        text: query,
        from: from.toISOString(),
        to: to.toISOString(),
        windowMinutes,
        limit,
      },
      safety: {
        arbitraryShell: false,
        commandSource: 'provider_sdk_adapter',
        readOnlyOnly: true,
        secretsInOutput: 'must_mask_before_persisting',
        liveExecutionDefault: 'requires_feature_flag_and_confirmLiveRead',
      },
      plannedCalls: [
        {
          provider: 'aliyun-sls',
          operation: 'GetLogs',
          params: {
            region,
            project,
            logstore,
            query,
            from: from.toISOString(),
            to: to.toISOString(),
            limit,
          },
        },
      ],
      resultContract: {
        shape: 'log_lines',
        columns: [
          { key: 'time', label: 'Time', type: 'datetime', masked: false },
          { key: 'level', label: 'Level', type: 'string', masked: false },
          { key: 'message', label: 'Message', type: 'string', masked: true },
        ],
        rowLimitDefault: 100,
        rowLimitMax: 1000,
      },
      livePrerequisites: {
        credentialReady,
        adapterReady: true,
        liveEnabled,
        confirmationReady: liveConfirmed,
        requiredConfirmation: 'params.confirmLiveRead=true',
      },
      warnings,
      metadata: {
        logStreamId: stream.id,
        logCollectionRunId: runId,
        params,
        tail: options.tail,
        nextExecutorBoundary: 'aliyun_sls_sdk_adapter',
      },
    });

    if (!options.dryRun && executable) {
      const liveResult = await this.aliyunSlsLogQueryAdapter.query({
        teamId: stream.teamId,
        credentialId: stream.managedResource?.credentialId,
        project,
        logstore,
        region,
        endpoint: this.readString(config.endpoint) || this.readString(metadata.endpoint),
        query,
        from,
        to,
        limit,
        redactionPolicy: resolveLogRedactionPolicy(stream.metadata),
      });

      return {
        status: liveResult.status,
        executorKey: this.aliyunSlsLogQueryAdapter.key,
        adapterKey: this.aliyunSlsLogQueryAdapter.adapterKey,
        commandPlan,
        logs: liveResult.logs,
        result: liveResult.result,
        error: liveResult.error,
      };
    }

    return {
      status,
      executorKey: 'cloud-sdk',
      adapterKey,
      commandPlan,
      logs: this.toJsonValue([
        {
          level: status === 'completed' ? 'info' : 'warn',
          message: options.dryRun
            ? `SLS GetLogs dry-run 查询计划已生成: ${project}/${logstore}`
            : error,
        },
      ]),
      result: this.toJsonValue({
        mode: options.dryRun ? 'dry_run_query_plan' : 'blocked_live_execution',
        executed: false,
        executorKey: 'cloud-sdk',
        adapterKey,
        provider: 'aliyun-sls',
        query: {
          project,
          logstore,
          region,
          text: query,
          from: from.toISOString(),
          to: to.toISOString(),
          limit,
        },
        stdoutPreview: sampleLines.join('\n'),
        preview: {
          source: 'contract_sample',
          sample: true,
          rows: sampleLines.map((line, index) => ({
            time: index === 0 ? from.toISOString() : to.toISOString(),
            level: index === 0 ? 'info' : 'warn',
            message: line,
          })),
          redaction: {
            enabled: true,
            policy: 'mask_secret_like_fields_before_persisting',
          },
        },
        warnings,
        livePrerequisites: {
          credentialReady,
          adapterReady: true,
          liveEnabled,
          confirmationReady: liveConfirmed,
        },
      }),
      error,
    };
  }

  private async resolveTargetContext(
    teamId: string,
    dto: CreateLogStreamDto,
  ): Promise<TargetContext> {
    if (dto.applicationServiceId) {
      const service = await this.prisma.applicationService.findFirst({
        where: { id: dto.applicationServiceId, teamId },
        select: {
          id: true,
          projectId: true,
          applicationId: true,
          environmentId: true,
          serverId: true,
          siteId: true,
          managedResourceId: true,
        },
      });
      if (!service) throw new NotFoundException('应用服务不存在');
      return {
        sourceType: 'docker',
        projectId: service.projectId,
        applicationId: service.applicationId,
        environmentId: service.environmentId,
        applicationServiceId: service.id,
        serverId: service.serverId,
        siteId: service.siteId,
        managedResourceId: service.managedResourceId,
      };
    }

    if (dto.deploymentRunId) {
      const run = await this.prisma.deploymentRun.findFirst({
        where: { id: dto.deploymentRunId, teamId },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          applicationId: true,
          applicationServiceId: true,
          serverId: true,
        },
      });
      if (!run) throw new NotFoundException('部署运行不存在');
      return {
        sourceType: 'deployment',
        deploymentRunId: run.id,
        projectId: run.projectId,
        environmentId: run.environmentId,
        applicationId: run.applicationId,
        applicationServiceId: run.applicationServiceId,
        serverId: run.serverId,
      };
    }

    if (dto.backupRunId) {
      const run = await this.prisma.backupRun.findFirst({
        where: { id: dto.backupRunId, teamId },
        select: {
          id: true,
          planId: true,
          projectId: true,
          environmentId: true,
          serverId: true,
          resourceId: true,
        },
      });
      if (!run) throw new NotFoundException('备份运行不存在');
      return {
        sourceType: 'backup',
        backupRunId: run.id,
        backupPlanId: run.planId,
        projectId: run.projectId,
        environmentId: run.environmentId,
        serverId: run.serverId,
        managedResourceId: run.resourceId,
      };
    }

    if (dto.backupPlanId) {
      const plan = await this.prisma.backupPlan.findFirst({
        where: { id: dto.backupPlanId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true, resourceId: true },
      });
      if (!plan) throw new NotFoundException('备份计划不存在');
      return {
        sourceType: 'backup',
        backupPlanId: plan.id,
        projectId: plan.projectId,
        environmentId: plan.environmentId,
        serverId: plan.serverId,
        managedResourceId: plan.resourceId,
      };
    }

    if (dto.alertEventId) {
      const event = await this.prisma.alertEvent.findFirst({
        where: { id: dto.alertEventId, teamId },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          applicationId: true,
          applicationServiceId: true,
          serverId: true,
          siteId: true,
          managedResourceId: true,
          backupPlanId: true,
        },
      });
      if (!event) throw new NotFoundException('告警事件不存在');
      return {
        sourceType: 'alert',
        alertEventId: event.id,
        projectId: event.projectId,
        environmentId: event.environmentId,
        applicationId: event.applicationId,
        applicationServiceId: event.applicationServiceId,
        serverId: event.serverId,
        siteId: event.siteId,
        managedResourceId: event.managedResourceId,
        backupPlanId: event.backupPlanId,
      };
    }

    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true },
      });
      if (!site) throw new NotFoundException('站点不存在');
      return {
        sourceType: 'nginx',
        siteId: site.id,
        projectId: site.projectId,
        environmentId: site.environmentId,
        serverId: site.serverId,
      };
    }

    if (dto.managedResourceId) {
      const resource = await this.prisma.managedResource.findFirst({
        where: { id: dto.managedResourceId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true, provider: true, kind: true },
      });
      if (!resource) throw new NotFoundException('托管资源不存在');
      return {
        sourceType: resource.provider === 'aliyun-sls' || resource.kind === 'log_service' ? 'sls' : 'manual',
        managedResourceId: resource.id,
        projectId: resource.projectId,
        environmentId: resource.environmentId,
        serverId: resource.serverId,
      };
    }

    if (dto.serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: dto.serverId, teamId },
        select: { id: true },
      });
      if (!server) throw new NotFoundException('服务器不存在');
      await this.validateLooseScope(teamId, dto);
      return {
        sourceType: 'server_executor',
        projectId: dto.projectId,
        environmentId: dto.environmentId,
        applicationId: dto.applicationId,
        serverId: server.id,
      };
    }

    await this.validateLooseScope(teamId, dto);
    return {
      sourceType: dto.sourceType || 'manual',
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      applicationId: dto.applicationId,
    };
  }

  private async validateLooseScope(teamId: string, dto: CreateLogStreamDto) {
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('项目不存在');
    }

    if (dto.environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: dto.environmentId, teamId },
        select: { id: true, projectId: true },
      });
      if (!environment) throw new NotFoundException('项目环境不存在');
      if (dto.projectId && environment.projectId !== dto.projectId) {
        throw new BadRequestException('项目环境不属于指定项目');
      }
    }

    if (dto.applicationId) {
      const application = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, teamId },
        select: { id: true, projectId: true },
      });
      if (!application) throw new NotFoundException('应用不存在');
      if (dto.projectId && application.projectId !== dto.projectId) {
        throw new BadRequestException('应用不属于指定项目');
      }
    }
  }

  private normalizeTail(tail?: number) {
    if (!tail || Number.isNaN(tail)) return 200;
    return Math.max(1, Math.min(Math.floor(tail), 5000));
  }

  private normalizeTailEntryLimit(limit?: number) {
    if (!limit || Number.isNaN(limit)) return 100;
    return Math.max(1, Math.min(Math.floor(limit), 500));
  }

  private parseTailCursor(cursor?: string) {
    if (!cursor) return null;
    const [timestampValue, createdAtValue, id] = cursor.split('|');
    const timestamp = new Date(timestampValue);
    const createdAt = new Date(createdAtValue);
    if (!timestampValue || !createdAtValue || !id || Number.isNaN(timestamp.getTime()) || Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('日志 tail cursor 无效');
    }
    return { timestamp, createdAt, id };
  }

  private buildTailCursor(timestamp: Date, createdAt: Date, id: string) {
    return `${timestamp.toISOString()}|${createdAt.toISOString()}|${id}`;
  }

  private isServerCollectableSource(sourceType: string) {
    return ['docker', 'nginx', 'server_executor'].includes(sourceType);
  }

  private normalizeVarLogPath(value?: string | null, namespace?: string) {
    if (!value) return null;
    const trimmed = value.trim();
    const prefix = namespace ? `/var/log/${namespace}/` : '/var/log/';
    if (!trimmed.startsWith(prefix)) return null;
    if (trimmed.includes('..')) return null;
    if (!/^[a-zA-Z0-9_./@-]+\.log$/.test(trimmed)) return null;
    return trimmed;
  }

  private firstCommandToken(...values: unknown[]) {
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (/^[a-zA-Z0-9_.:/@-]+$/.test(trimmed)) {
        return trimmed;
      }
    }
    return null;
  }

  private readString(value: unknown) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private readStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.readString(item))
      .filter((item): item is string => Boolean(item));
  }

  private positiveInt(value: unknown, fallback: number, max: number) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : fallback;
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), max);
  }

  private isLiveSlsQueryConfirmed(params: Record<string, unknown>) {
    return params.confirmLiveRead === true;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeEntries(dto: AppendLogEntriesDto): NormalizedLogEntry[] {
    if (dto.entries && dto.entries.length > 0) {
      return dto.entries.map((entry) => ({
        level: entry.level || 'info',
        message: this.requireMessage(entry.message),
        timestamp: entry.timestamp ? new Date(entry.timestamp) : undefined,
        source: entry.source,
        labels: entry.labels,
        context: entry.context,
        raw: entry.raw,
      }));
    }

    if (!dto.message) {
      return [];
    }

    return [
      {
        level: dto.level || 'info',
        message: this.requireMessage(dto.message),
        source: dto.source,
        labels: dto.labels,
        context: dto.context,
        raw: dto.raw,
      },
    ];
  }

  private requireMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('日志消息不能为空');
    }
    return trimmed;
  }

  private async writeLogAudit(
    teamId: string,
    userId: string,
    stream: LogStreamRecord,
    entry: { id: string; level: string; message: string },
    count: number,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: stream.projectId,
      environmentId: stream.environmentId,
      applicationId: stream.applicationId,
      applicationServiceId: stream.applicationServiceId,
      serverId: stream.serverId,
      siteId: stream.siteId,
      managedResourceId: stream.managedResourceId,
      deploymentRunId: stream.deploymentRunId,
      backupRunId: stream.backupRunId,
      alertEventId: stream.alertEventId,
      logStreamId: stream.id,
      logEntryId: entry.id,
      category: 'log',
      action: 'log.append',
      targetType: 'log_stream',
      targetId: stream.id,
      risk: entry.level === 'error' || entry.level === 'fatal' ? 'medium' : 'low',
      status: 'completed',
      summary: `日志流 ${stream.name} 追加 ${count} 条日志`,
      metadata: {
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        count,
        lastLevel: entry.level,
        lastMessage: entry.message,
      },
    });
  }

  private async writeCollectionAudit(
    teamId: string,
    userId: string | null,
    stream: LogStreamRecord,
    run: LogCollectionRunRecord,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: stream.projectId,
      environmentId: stream.environmentId,
      applicationId: stream.applicationId,
      applicationServiceId: stream.applicationServiceId,
      serverId: stream.serverId,
      siteId: stream.siteId,
      managedResourceId: stream.managedResourceId,
      deploymentRunId: stream.deploymentRunId,
      backupRunId: stream.backupRunId,
      alertEventId: stream.alertEventId,
      logStreamId: stream.id,
      logCollectionRunId: run.id,
      category: 'log',
      action: 'log.collect',
      targetType: 'log_collection_run',
      targetId: run.id,
      risk: 'low',
      status: run.status,
      summary: `日志流 ${stream.name} 生成采集计划: ${run.status}`,
      metadata: {
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        dryRun: run.dryRun,
        tail: run.tail,
        executorKey: run.executorKey,
        adapterKey: run.adapterKey,
        error: run.error,
      },
    });
  }

  private async writeRetentionAudit(
    teamId: string,
    userId: string | null,
    stream: LogStreamRecord,
    run: LogRetentionRunRecord,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: stream.projectId,
      environmentId: stream.environmentId,
      applicationId: stream.applicationId,
      applicationServiceId: stream.applicationServiceId,
      serverId: stream.serverId,
      siteId: stream.siteId,
      managedResourceId: stream.managedResourceId,
      deploymentRunId: stream.deploymentRunId,
      backupRunId: stream.backupRunId,
      alertEventId: stream.alertEventId,
      logStreamId: stream.id,
      logRetentionRunId: run.id,
      category: 'log',
      action: 'log.retention.cleanup',
      targetType: 'log_retention_run',
      targetId: run.id,
      risk: run.dryRun ? 'low' : 'high',
      status: run.status,
      summary: `日志流 ${stream.name} 保留清理: ${run.dryRun ? 'dry-run' : 'live'} ${run.status}`,
      metadata: {
        streamId: stream.id,
        retentionDays: run.retentionDays,
        cutoffAt: run.cutoffAt,
        dryRun: run.dryRun,
        matchedEntryCount: run.matchedEntryCount,
        deletedEntryCount: run.deletedEntryCount,
        error: run.error,
      },
    });
  }

  private async refreshLogStreamLastEntry(streamId: string) {
    const latest = await this.prisma.logEntry.findFirst({
      where: { streamId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true, level: true, message: true },
    });

    return this.prisma.logStream.update({
      where: { id: streamId },
      data: {
        lastEntryAt: latest?.timestamp || null,
        lastLevel: latest?.level || null,
        lastMessage: latest?.message || null,
      },
    });
  }

  private stripSourceType(target: TargetContext) {
    const { sourceType: _sourceType, ...rest } = target;
    return rest;
  }

  private terminalCollectionStatus(status: string): CollectionExecutionResult['status'] {
    return status as CollectionExecutionResult['status'];
  }

  private buildLogEntryWhere(teamId: string, query: ListLogEntriesQueryDto | ListLogStatsQueryDto) {
    const where: Prisma.LogEntryWhereInput = { teamId };

    if (query.streamId) where.streamId = query.streamId;
    if ('level' in query && query.level) where.level = query.level;
    if (query.source) where.source = query.source;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.applicationServiceId) where.applicationServiceId = query.applicationServiceId;
    if (query.serverId) where.serverId = query.serverId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.managedResourceId) where.managedResourceId = query.managedResourceId;
    if ('q' in query && query.q) {
      where.message = { contains: query.q };
    }

    return where;
  }

  private normalizeWindowMinutes(value: unknown) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : 60;
    if (!Number.isFinite(parsed)) return 60;
    return Math.min(Math.max(Math.floor(parsed), 1), 10080);
  }

  private emptyEntryStats(windowMinutes: number, from: Date, to: Date) {
    return {
      windowMinutes,
      from,
      to,
      total: 0,
      byLevel: [],
      countByLevel: {},
      warningCount: 0,
      errorCount: 0,
      fatalCount: 0,
      latestEntry: null,
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
