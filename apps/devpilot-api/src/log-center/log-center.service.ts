import { Injectable, Optional } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorService } from "../server-executor/server-executor.service";
import { AliyunSlsLogQueryAdapter } from "./aliyun-sls-log-query.adapter";
import {
  createLogCenterServiceDependencies,
  LogCenterServiceDependencies,
} from "./log-center-service-dependencies.service";
import { LogCollectionIngestionService } from "./log-collection-ingestion.service";
import { LogEntryQueryService } from "./log-entry-query.service";
import { LogRunQueryService } from "./log-run-query.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamQueryService } from "./log-stream-query.service";
import { LogStreamWriteOrchestrationService } from "./log-stream-write-orchestration.service";
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
} from "./dto/log-center.dto";

@Injectable()
export class LogCenterService {
  private readonly deps: LogCenterServiceDependencies;

  constructor(
    prisma: PrismaService,
    auditEventService: AuditEventService,
    serverExecutorService: ServerExecutorService,
    logCollectionIngestionService: LogCollectionIngestionService,
    aliyunSlsLogQueryAdapter: AliyunSlsLogQueryAdapter,
    @Optional()
    logStreamMutationService?: LogStreamMutationService,
    @Optional()
    logEntryQueryService?: LogEntryQueryService,
    @Optional()
    logStreamQueryService?: LogStreamQueryService,
    @Optional()
    logRunQueryService?: LogRunQueryService,
    @Optional()
    logStreamWriteOrchestrationService?: LogStreamWriteOrchestrationService,
  ) {
    this.deps = createLogCenterServiceDependencies({
      prisma,
      auditEventService,
      serverExecutorService,
      logCollectionIngestionService,
      aliyunSlsLogQueryAdapter,
      logStreamMutationService,
      logEntryQueryService,
      logStreamQueryService,
      logRunQueryService,
      logStreamWriteOrchestrationService,
    });
  }

  async listStreams(teamId: string, query: ListLogStreamsQueryDto) {
    return this.deps.logStreamQueryService.list(teamId, query);
  }

  async listEntries(teamId: string, query: ListLogEntriesQueryDto) {
    return this.deps.logEntryQueryService.list(teamId, query);
  }

  async tailStreamEntries(
    teamId: string,
    streamId: string,
    query: TailLogEntriesQueryDto,
  ) {
    return this.deps.logEntryQueryService.tail(teamId, streamId, query);
  }

  async getEntryStats(
    teamId: string,
    query: ListLogStatsQueryDto,
    readableStreamIds: string[],
  ) {
    return this.deps.logEntryQueryService.stats(
      teamId,
      query,
      readableStreamIds,
    );
  }

  async listCollectionRuns(
    teamId: string,
    query: ListLogCollectionRunsQueryDto,
  ) {
    return this.deps.logRunQueryService.listCollectionRuns(teamId, query);
  }

  async listRetentionRuns(teamId: string, query: ListLogRetentionRunsQueryDto) {
    return this.deps.logRunQueryService.listRetentionRuns(teamId, query);
  }

  async resolveStreamCreateAccessScope(
    teamId: string,
    dto: CreateLogStreamDto,
  ) {
    return this.deps.logStreamMutationService.resolveCreateAccessScope(
      teamId,
      dto,
    );
  }

  async getStreamAccessScope(teamId: string, streamId: string) {
    return this.deps.logStreamQueryService.accessScope(teamId, streamId);
  }

  async collectStream(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CollectLogStreamDto,
  ) {
    return this.deps.logStreamWriteOrchestrationService.collect(
      teamId,
      userId,
      streamId,
      dto,
    );
  }

  async createStream(teamId: string, userId: string, dto: CreateLogStreamDto) {
    return this.deps.logStreamMutationService.create(teamId, userId, dto);
  }

  async updateStream(
    teamId: string,
    streamId: string,
    dto: UpdateLogStreamDto,
  ) {
    return this.deps.logStreamWriteOrchestrationService.update(
      teamId,
      streamId,
      dto,
    );
  }

  async appendEntries(
    teamId: string,
    userId: string,
    streamId: string,
    dto: AppendLogEntriesDto,
  ) {
    return this.deps.logStreamWriteOrchestrationService.append(
      teamId,
      userId,
      streamId,
      dto,
    );
  }

  async cleanupRetention(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CleanupLogRetentionDto,
  ) {
    return this.deps.logStreamWriteOrchestrationService.cleanupRetention(
      teamId,
      userId,
      streamId,
      dto,
    );
  }
}
