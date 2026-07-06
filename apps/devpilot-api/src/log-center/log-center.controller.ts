import {
  Body,
  Controller,
  Get,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import {
  CreateLogStreamDto,
  ListLogCollectionRunsQueryDto,
  ListLogEntriesQueryDto,
  ListLogRetentionRunsQueryDto,
  ListLogStatsQueryDto,
  ListLogStreamsQueryDto,
  UpdateLogStreamDto,
} from "./dto/log-center.dto";
import { LogCenterAccessService } from "./log-center-access.service";
import { AuthRequest } from "./log-center-controller.types";
import { LogCenterService } from "./log-center.service";

@Controller("logs")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class LogCenterController {
  private readonly access: LogCenterAccessService;

  constructor(
    private readonly logCenterService: LogCenterService,
    accessPolicyService: ControlAccessPolicyService,
    @Optional()
    logCenterAccessService?: LogCenterAccessService,
  ) {
    this.access =
      logCenterAccessService ??
      new LogCenterAccessService(accessPolicyService, logCenterService);
  }

  @Get("streams")
  async listStreams(
    @Request() req: AuthRequest,
    @Query() query: ListLogStreamsQueryDto,
  ) {
    const streams = await this.logCenterService.listStreams(req.teamId, query);
    return this.access.filterReadableLogRecords(
      req,
      streams,
      "log.stream.read",
      "log_stream",
    );
  }

  @Post("streams")
  async createStream(
    @Request() req: AuthRequest,
    @Body() dto: CreateLogStreamDto,
  ) {
    const scope = await this.logCenterService.resolveStreamCreateAccessScope(
      req.teamId,
      dto,
    );
    await this.access.assertCanWriteLog(
      req,
      "log.stream.create",
      null,
      scope.projectId,
      scope.environmentId,
    );
    return this.logCenterService.createStream(req.teamId, req.user.id, dto);
  }

  @Put("streams/:streamId")
  async updateStream(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Body() dto: UpdateLogStreamDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanWriteLog(
      req,
      "log.stream.update",
      streamId,
      scope.projectId,
      scope.environmentId,
    );
    return this.logCenterService.updateStream(req.teamId, streamId, dto);
  }

  @Get("collection-runs")
  async listCollectionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListLogCollectionRunsQueryDto,
  ) {
    const runs = await this.logCenterService.listCollectionRuns(
      req.teamId,
      query,
    );
    return this.access.filterReadableLogRecords(
      req,
      runs,
      "log.collection_run.read",
      "log_collection_run",
    );
  }

  @Get("retention-runs")
  async listRetentionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListLogRetentionRunsQueryDto,
  ) {
    const runs = await this.logCenterService.listRetentionRuns(
      req.teamId,
      query,
    );
    return this.access.filterReadableLogRecords(
      req,
      runs,
      "log.retention_run.read",
      "log_retention_run",
    );
  }

  @Get("entries")
  async listEntries(
    @Request() req: AuthRequest,
    @Query() query: ListLogEntriesQueryDto,
  ) {
    const entries = await this.logCenterService.listEntries(req.teamId, query);
    return this.access.filterReadableLogRecords(
      req,
      entries,
      "log.entry.read",
      "log_entry",
    );
  }

  @Get("stats")
  async getStats(
    @Request() req: AuthRequest,
    @Query() query: ListLogStatsQueryDto,
  ) {
    const readableStreamIds =
      await this.access.resolveReadableStreamIdsForStats(req, query);
    return this.logCenterService.getEntryStats(
      req.teamId,
      query,
      readableStreamIds,
    );
  }
}
