import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AuditEventService } from "../audit-event";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import {
  SseSessionLimitError,
  SseSessionManager,
} from "../common/sse/sse-session-manager";
import {
  StreamLogEntriesQueryDto,
  TailLogEntriesQueryDto,
} from "./dto/log-center.dto";
import { LogCenterAccessService } from "./log-center-access.service";
import { AuthRequest, TailEventRequest } from "./log-center-controller.types";
import { LogCenterService } from "./log-center.service";
import { LogStreamSessionRegistry } from "./log-stream-session.registry";
import { LogStreamSessionAuditService } from "./log-stream-session-audit.service";
import {
  normalizeStreamMaxActiveSessions,
  normalizeStreamMaxActorActiveSessions,
  normalizeStreamMaxSessionMs,
  normalizeStreamMaxTeamActiveSessions,
  normalizeStreamPollInterval,
} from "./log-stream-tail-limits.utils";

@Controller("logs")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class LogStreamTailController {
  private readonly access: LogCenterAccessService;
  private readonly sessionAudit: LogStreamSessionAuditService;
  private readonly sseSessionManager: SseSessionManager;

  constructor(
    private readonly logCenterService: LogCenterService,
    accessPolicyService: ControlAccessPolicyService,
    private readonly logStreamSessionRegistry: LogStreamSessionRegistry = new LogStreamSessionRegistry(),
    @Optional()
    auditEventService?: AuditEventService,
    @Optional()
    logCenterAccessService?: LogCenterAccessService,
    @Optional()
    logStreamSessionAuditService?: LogStreamSessionAuditService,
  ) {
    this.access =
      logCenterAccessService ??
      new LogCenterAccessService(accessPolicyService, logCenterService);
    this.sessionAudit =
      logStreamSessionAuditService ??
      new LogStreamSessionAuditService(auditEventService);
    this.sseSessionManager = new SseSessionManager(
      this.logStreamSessionRegistry,
    );
  }

  @Get("stream-sessions")
  async listStreamSessions(
    @Request() req: AuthRequest,
    @Query("streamId") streamId?: string,
  ) {
    const sessions = this.logStreamSessionRegistry.list(req.teamId, streamId);
    return this.access.filterReadableLogSessions(req, sessions);
  }

  @Post("stream-sessions/:sessionId/close")
  async closeStreamSession(
    @Request() req: AuthRequest,
    @Param("sessionId") sessionId: string,
  ) {
    const session = this.logStreamSessionRegistry.get(req.teamId, sessionId);
    if (!session) throw new NotFoundException("日志流会话不存在或已关闭");

    await this.access.assertCanWriteLog(
      req,
      "log.stream_session.close",
      session.streamId,
      session.projectId,
      session.environmentId,
      "low",
    );
    const closed = this.logStreamSessionRegistry.closeSession(
      req.teamId,
      sessionId,
      "manual_close",
    );
    if (closed)
      await this.sessionAudit.recordManualClose(req, session, "manual_close");

    return {
      sessionId,
      streamId: session.streamId,
      status: closed ? "closing" : "not_found",
    };
  }

  @Get("streams/:streamId/tail")
  async tailStreamEntries(
    @Request() req: AuthRequest,
    @Param("streamId") streamId: string,
    @Query() query: TailLogEntriesQueryDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanReadLog(
      req,
      "log.stream.tail",
      streamId,
      scope.projectId,
      scope.environmentId,
    );
    return this.logCenterService.tailStreamEntries(req.teamId, streamId, query);
  }

  @Get("streams/:streamId/events")
  async streamTailEvents(
    @Request() req: TailEventRequest,
    @Param("streamId") streamId: string,
    @Query() query: StreamLogEntriesQueryDto,
    @Headers("last-event-id") lastEventId: string | undefined,
    @Res() res: Response,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(
      req.teamId,
      streamId,
    );
    await this.access.assertCanReadLog(
      req,
      "log.stream.tail",
      streamId,
      scope.projectId,
      scope.environmentId,
    );

    try {
      const { close } = await this.sseSessionManager.start({
        response: res,
        teamId: req.teamId,
        actorId: req.user.id,
        streamId,
        projectId: scope.projectId,
        environmentId: scope.environmentId,
        initialCursor: query.cursor || lastEventId || null,
        limits: {
          pollIntervalMs: normalizeStreamPollInterval(query.pollIntervalMs),
          maxSessionMs: normalizeStreamMaxSessionMs(query.maxSessionMs),
          maxActiveSessions: normalizeStreamMaxActiveSessions(),
          maxActorActiveSessions: normalizeStreamMaxActorActiveSessions(),
          maxTeamActiveSessions: normalizeStreamMaxTeamActiveSessions(),
        },
        pollHandler: async (cursor) => {
          const tail = await this.logCenterService.tailStreamEntries(
            req.teamId,
            streamId,
            {
              cursor: cursor || undefined,
              limit: query.limit,
            },
          );
          return {
            cursor: tail.cursor || cursor,
            entries: tail.entries,
            rawData: tail as unknown as Record<string, unknown>,
          };
        },
      });
      req.on?.("close", close);
    } catch (error) {
      if (error instanceof SseSessionLimitError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
