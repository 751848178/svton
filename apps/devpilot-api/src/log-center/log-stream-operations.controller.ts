import {
  Body,
  Controller,
  Get,
  Optional,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import {
  AppendLogEntriesDto,
  CleanupLogRetentionDto,
  CollectLogStreamDto,
  ListLogEntriesQueryDto,
} from "./dto/log-center.dto";
import { LogCenterAccessService } from "./log-center-access.service";
import { AuthRequest } from "./log-center-controller.types";
import { LogCenterService } from "./log-center.service";

@Controller("logs")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class LogStreamOperationsController {
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

  @Get("streams/:streamId/entries")
  async listStreamEntries(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Query() query: ListLogEntriesQueryDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanReadLog(
      req,
      "log.stream.read",
      streamId,
      scope.projectId,
      scope.environmentId,
    );
    const entries = await this.logCenterService.listEntries(req.teamId, {
      ...query,
      streamId,
    });
    return this.access.filterReadableLogRecords(
      req,
      entries,
      "log.entry.read",
      "log_entry",
    );
  }

  @Post("streams/:streamId/collect")
  async collectStream(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Body() dto: CollectLogStreamDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanWriteLog(
      req,
      "log.collect",
      streamId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? "medium" : "low",
    );
    return this.logCenterService.collectStream(
      req.teamId,
      req.user.id,
      streamId,
      dto,
    );
  }

  @Post("streams/:streamId/retention/cleanup")
  async cleanupRetention(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Body() dto: CleanupLogRetentionDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanWriteLog(
      req,
      "log.retention.cleanup",
      streamId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? "high" : "low",
    );
    return this.logCenterService.cleanupRetention(
      req.teamId,
      req.user.id,
      streamId,
      dto,
    );
  }

  @Post("streams/:streamId/entries")
  async appendEntries(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Body() dto: AppendLogEntriesDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanWriteLog(
      req,
      "log.entries.append",
      streamId,
      scope.projectId,
      scope.environmentId,
    );
    return this.logCenterService.appendEntries(
      req.teamId,
      req.user.id,
      streamId,
      dto,
    );
  }
}
