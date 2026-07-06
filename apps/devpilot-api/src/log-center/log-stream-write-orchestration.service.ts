import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AppendLogEntriesDto,
  CleanupLogRetentionDto,
  CollectLogStreamDto,
  UpdateLogStreamDto,
} from "./dto/log-center.dto";
import { LogCollectionRunExecutionService } from "./log-collection-run-execution.service";
import { LogEntryAppendService } from "./log-entry-append.service";
import { LogRetentionCleanupService } from "./log-retention-cleanup.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamQueryService } from "./log-stream-query.service";

@Injectable()
export class LogStreamWriteOrchestrationService {
  constructor(
    private readonly logStreamQueryService: LogStreamQueryService,
    private readonly logCollectionRunExecutionService: LogCollectionRunExecutionService,
    private readonly logStreamMutationService: LogStreamMutationService,
    private readonly logEntryAppendService: LogEntryAppendService,
    private readonly logRetentionCleanupService: LogRetentionCleanupService,
  ) {}

  async collect(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CollectLogStreamDto,
  ) {
    const stream = await this.logStreamQueryService.get(teamId, streamId);
    this.assertCollectable(stream);
    return this.logCollectionRunExecutionService.execute(
      teamId,
      userId,
      stream,
      dto,
    );
  }

  async update(teamId: string, streamId: string, dto: UpdateLogStreamDto) {
    const stream = await this.logStreamQueryService.get(teamId, streamId);
    return this.logStreamMutationService.update(stream, dto);
  }

  async append(
    teamId: string,
    userId: string,
    streamId: string,
    dto: AppendLogEntriesDto,
  ) {
    const stream = await this.logStreamQueryService.get(teamId, streamId);
    this.assertAppendable(stream);
    return this.logEntryAppendService.append(teamId, userId, stream, dto);
  }

  async cleanupRetention(
    teamId: string,
    userId: string | null,
    streamId: string,
    dto: CleanupLogRetentionDto,
  ) {
    const stream = await this.logStreamQueryService.get(teamId, streamId);
    return this.logRetentionCleanupService.cleanup(teamId, userId, stream, dto);
  }

  private assertCollectable(stream: { status: string }) {
    if (stream.status === "archived") {
      throw new BadRequestException("归档的日志流不能发起采集");
    }
  }

  private assertAppendable(stream: { status: string }) {
    if (stream.status === "archived") {
      throw new BadRequestException("归档的日志流不能追加日志");
    }
  }
}
