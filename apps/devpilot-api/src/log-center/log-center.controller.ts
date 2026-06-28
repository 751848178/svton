import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { AuditEventService } from '../audit-event';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
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
  StreamLogEntriesQueryDto,
  TailLogEntriesQueryDto,
  UpdateLogStreamDto,
} from './dto/log-center.dto';
import { LogCenterService } from './log-center.service';
import { LogStreamSessionRecord, LogStreamSessionRegistry } from './log-stream-session.registry';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableLogRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  stream?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
};

@Controller('logs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class LogCenterController {
  constructor(
    private readonly logCenterService: LogCenterService,
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly logStreamSessionRegistry: LogStreamSessionRegistry = new LogStreamSessionRegistry(),
    @Optional()
    private readonly auditEventService?: AuditEventService,
  ) {}

  @Get('streams')
  async listStreams(
    @Request() req: AuthRequest,
    @Query() query: ListLogStreamsQueryDto,
  ) {
    const streams = await this.logCenterService.listStreams(req.teamId, query);
    return this.filterReadableLogRecords(req, streams, 'log.stream.read', 'log_stream');
  }

  @Post('streams')
  async createStream(
    @Request() req: AuthRequest,
    @Body() dto: CreateLogStreamDto,
  ) {
    const scope = await this.logCenterService.resolveStreamCreateAccessScope(req.teamId, dto);
    await this.assertCanWriteLog(req, 'log.stream.create', null, scope.projectId, scope.environmentId, 'low');
    return this.logCenterService.createStream(req.teamId, req.user.id, dto);
  }

  @Put('streams/:streamId')
  async updateStream(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Body() dto: UpdateLogStreamDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanWriteLog(req, 'log.stream.update', streamId, scope.projectId, scope.environmentId, 'low');
    return this.logCenterService.updateStream(req.teamId, streamId, dto);
  }

  @Get('collection-runs')
  async listCollectionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListLogCollectionRunsQueryDto,
  ) {
    const runs = await this.logCenterService.listCollectionRuns(req.teamId, query);
    return this.filterReadableLogRecords(req, runs, 'log.collection_run.read', 'log_collection_run');
  }

  @Get('retention-runs')
  async listRetentionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListLogRetentionRunsQueryDto,
  ) {
    const runs = await this.logCenterService.listRetentionRuns(req.teamId, query);
    return this.filterReadableLogRecords(req, runs, 'log.retention_run.read', 'log_retention_run');
  }

  @Get('entries')
  async listEntries(
    @Request() req: AuthRequest,
    @Query() query: ListLogEntriesQueryDto,
  ) {
    const entries = await this.logCenterService.listEntries(req.teamId, query);
    return this.filterReadableLogRecords(req, entries, 'log.entry.read', 'log_entry');
  }

  @Get('stats')
  async getStats(
    @Request() req: AuthRequest,
    @Query() query: ListLogStatsQueryDto,
  ) {
    const readableStreamIds = await this.resolveReadableStreamIdsForStats(req, query);
    return this.logCenterService.getEntryStats(req.teamId, query, readableStreamIds);
  }

  @Get('stream-sessions')
  async listStreamSessions(
    @Request() req: AuthRequest,
    @Query('streamId') streamId?: string,
  ) {
    const sessions = this.logStreamSessionRegistry.list(req.teamId, streamId);
    return this.filterReadableLogSessions(req, sessions);
  }

  @Post('stream-sessions/:sessionId/close')
  async closeStreamSession(
    @Request() req: AuthRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const session = this.logStreamSessionRegistry.get(req.teamId, sessionId);
    if (!session) {
      throw new NotFoundException('日志流会话不存在或已关闭');
    }
    await this.assertCanWriteLog(
      req,
      'log.stream_session.close',
      session.streamId,
      session.projectId,
      session.environmentId,
      'low',
    );
    const closed = this.logStreamSessionRegistry.closeSession(req.teamId, sessionId, 'manual_close');
    if (closed) {
      await this.writeStreamSessionAudit(req, session, 'manual_close');
    }
    return {
      sessionId,
      streamId: session.streamId,
      status: closed ? 'closing' : 'not_found',
    };
  }

  @Get('streams/:streamId/tail')
  async tailStreamEntries(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Query() query: TailLogEntriesQueryDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanReadLog(req, 'log.stream.tail', streamId, scope.projectId, scope.environmentId, 'log_stream');
    return this.logCenterService.tailStreamEntries(req.teamId, streamId, query);
  }

  @Get('streams/:streamId/events')
  async streamTailEvents(
    @Request() req: AuthRequest & { on?: (event: string, handler: () => void) => void },
    @Param('streamId') streamId: string,
    @Query() query: StreamLogEntriesQueryDto,
    @Headers('last-event-id') lastEventId: string | undefined,
    @Res() res: Response,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanReadLog(req, 'log.stream.tail', streamId, scope.projectId, scope.environmentId, 'log_stream');

    const pollIntervalMs = this.normalizeStreamPollInterval(query.pollIntervalMs);
    const maxSessionMs = this.normalizeStreamMaxSessionMs(query.maxSessionMs);
    const maxActiveSessions = this.normalizeStreamMaxActiveSessions();
    const maxActorActiveSessions = this.normalizeStreamMaxActorActiveSessions();
    const maxTeamActiveSessions = this.normalizeStreamMaxTeamActiveSessions();
    if (this.logStreamSessionRegistry.countOpen(req.teamId, streamId) >= maxActiveSessions) {
      throw new BadRequestException('日志流活跃会话已达上限，请关闭旧会话后重试');
    }
    if (this.logStreamSessionRegistry.countOpenByActor(req.teamId, req.user.id) >= maxActorActiveSessions) {
      throw new BadRequestException('当前用户日志流活跃会话已达上限，请关闭旧会话后重试');
    }
    if (this.logStreamSessionRegistry.countOpen(req.teamId) >= maxTeamActiveSessions) {
      throw new BadRequestException('团队日志流活跃会话已达上限，请关闭旧会话后重试');
    }
    const sessionId = randomUUID();
    const openedAt = new Date();
    const expiresAt = new Date(openedAt.getTime() + maxSessionMs).toISOString();
    const response = res as Response & { flushHeaders?: () => void; writableEnded?: boolean };
    response.status(200);
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Log-Stream-Session-Id': sessionId,
      'X-Log-Stream-Session-Expires-At': expiresAt,
      'X-Log-Stream-Max-Active-Sessions': String(maxActiveSessions),
      'X-Log-Stream-Max-Actor-Active-Sessions': String(maxActorActiveSessions),
      'X-Log-Stream-Max-Team-Active-Sessions': String(maxTeamActiveSessions),
    });
    response.flushHeaders?.();

    let cursor = query.cursor || lastEventId || null;
    let polling = false;
    let closed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const writeEvent = (event: string, data: Record<string, unknown>, eventId?: string | null) => {
      if (closed || response.writableEnded) return;
      const payload = {
        ...data,
        sessionId,
        expiresAt,
        maxSessionMs,
      };
      if (eventId) {
        response.write(`id: ${eventId}\n`);
      }
      response.write(`retry: ${pollIntervalMs}\n`);
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const close = () => {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      if (expiryTimer) clearTimeout(expiryTimer);
      this.logStreamSessionRegistry.remove(sessionId);
    };

    const endSession = (reason: string = 'max_session_duration') => {
      if (closed || response.writableEnded) return;
      writeEvent('closing', {
        streamId,
        cursor,
        reason,
        at: new Date().toISOString(),
      }, cursor);
      close();
      response.end();
    };

    const poll = async () => {
      if (polling || closed || response.writableEnded) return;
      polling = true;
      try {
        const tail = await this.logCenterService.tailStreamEntries(req.teamId, streamId, {
          cursor: cursor || undefined,
          limit: query.limit,
        });
        cursor = tail.cursor || cursor;
        this.logStreamSessionRegistry.update(sessionId, {
          cursor,
          lastEventAt: new Date().toISOString(),
        });
        if (tail.entries.length > 0) {
          writeEvent('entries', tail as unknown as Record<string, unknown>, tail.cursor);
        } else {
          writeEvent('heartbeat', {
            streamId,
            cursor,
            at: new Date().toISOString(),
          }, cursor);
        }
      } catch (error) {
        writeEvent('error', {
          streamId,
          message: error instanceof Error ? error.message : '日志流式 tail 失败',
          at: new Date().toISOString(),
        }, cursor);
      } finally {
        polling = false;
      }
    };

    writeEvent('ready', {
      streamId,
      cursor,
      pollIntervalMs,
      maxActiveSessions,
      maxActorActiveSessions,
      maxTeamActiveSessions,
      openedAt: openedAt.toISOString(),
      at: new Date().toISOString(),
    }, cursor);
    this.logStreamSessionRegistry.open({
      id: sessionId,
      teamId: req.teamId,
      streamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      openedAt: openedAt.toISOString(),
      expiresAt,
      maxSessionMs,
      pollIntervalMs,
      cursor,
      lastEventAt: openedAt.toISOString(),
    }, endSession);
    await poll();
    timer = setInterval(poll, pollIntervalMs);
    expiryTimer = setTimeout(endSession, maxSessionMs);
    req.on?.('close', close);
  }

  @Get('streams/:streamId/entries')
  async listStreamEntries(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Query() query: ListLogEntriesQueryDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanReadLog(req, 'log.stream.read', streamId, scope.projectId, scope.environmentId, 'log_stream');
    const entries = await this.logCenterService.listEntries(req.teamId, {
      ...query,
      streamId,
    });
    return this.filterReadableLogRecords(req, entries, 'log.entry.read', 'log_entry');
  }

  @Post('streams/:streamId/collect')
  async collectStream(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Body() dto: CollectLogStreamDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanWriteLog(
      req,
      'log.collect',
      streamId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.logCenterService.collectStream(req.teamId, req.user.id, streamId, dto);
  }

  @Post('streams/:streamId/retention/cleanup')
  async cleanupRetention(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Body() dto: CleanupLogRetentionDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanWriteLog(
      req,
      'log.retention.cleanup',
      streamId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'low',
    );
    return this.logCenterService.cleanupRetention(req.teamId, req.user.id, streamId, dto);
  }

  @Post('streams/:streamId/entries')
  async appendEntries(
    @Request() req: AuthRequest,
    @Param('streamId') streamId: string,
    @Body() dto: AppendLogEntriesDto,
  ) {
    const scope = await this.logCenterService.getStreamAccessScope(req.teamId, streamId);
    await this.assertCanWriteLog(req, 'log.entries.append', streamId, scope.projectId, scope.environmentId, 'low');
    return this.logCenterService.appendEntries(req.teamId, req.user.id, streamId, dto);
  }

  private assertCanWriteLog(
    req: AuthRequest,
    action: string,
    streamId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'low',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'log',
      action,
      targetType: 'log_stream',
      targetId: streamId,
      risk,
    });
  }

  private assertCanReadLog(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = 'log_stream',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'log',
      action,
      targetType,
      targetId,
      risk: 'low',
    });
  }

  private async filterReadableLogRecords<T extends ReadableLogRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => ({
      record,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: record.projectId ?? record.stream?.projectId ?? null,
        environmentId: record.environmentId ?? record.stream?.environmentId ?? null,
        category: 'log',
        action,
        targetType,
        targetId: record.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  private async filterReadableLogSessions(
    req: AuthRequest,
    sessions: LogStreamSessionRecord[],
  ) {
    const allowed = await Promise.all(sessions.map(async (session) => ({
      session,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: session.projectId,
        environmentId: session.environmentId,
        category: 'log',
        action: 'log.stream.tail',
        targetType: 'log_stream',
        targetId: session.streamId,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.session);
  }

  private async writeStreamSessionAudit(
    req: AuthRequest,
    session: LogStreamSessionRecord,
    reason: string,
  ) {
    if (!this.auditEventService) return;

    await this.auditEventService.create({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: session.projectId,
      environmentId: session.environmentId,
      logStreamId: session.streamId,
      category: 'log',
      action: 'log.stream_session.close',
      targetType: 'log_stream_session',
      targetId: session.id,
      risk: 'low',
      status: 'completed',
      summary: `日志流会话 ${session.id} 已关闭`,
      metadata: {
        streamId: session.streamId,
        sessionId: session.id,
        sessionActorId: session.actorId,
        closeReason: reason,
        cursor: session.cursor,
        openedAt: session.openedAt,
        expiresAt: session.expiresAt,
        lastEventAt: session.lastEventAt,
      },
    });
  }

  private async resolveReadableStreamIdsForStats(
    req: AuthRequest,
    query: ListLogStatsQueryDto,
  ) {
    if (query.streamId) {
      const scope = await this.logCenterService.getStreamAccessScope(req.teamId, query.streamId);
      await this.assertCanReadLog(
        req,
        'log.stream.read',
        query.streamId,
        scope.projectId,
        scope.environmentId,
        'log_stream',
      );
      return [query.streamId];
    }

    const streams = await this.logCenterService.listStreams(req.teamId, query);
    const readableStreams = await this.filterReadableLogRecords(req, streams, 'log.stream.read', 'log_stream');
    return readableStreams.map((stream) => stream.id);
  }

  private normalizeStreamPollInterval(value?: number | string | null) {
    const interval = Number(value);
    if (!Number.isFinite(interval)) return 3000;
    return Math.max(1000, Math.min(Math.floor(interval), 30000));
  }

  private normalizeStreamMaxSessionMs(value?: number | string | null) {
    const sessionMs = Number(value);
    if (!Number.isFinite(sessionMs)) return 300000;
    return Math.max(30000, Math.min(Math.floor(sessionMs), 3600000));
  }

  private normalizeStreamMaxActiveSessions() {
    const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM);
    if (!Number.isFinite(limit)) return 5;
    return Math.max(1, Math.min(Math.floor(limit), 50));
  }

  private normalizeStreamMaxActorActiveSessions() {
    const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR);
    if (!Number.isFinite(limit)) return 10;
    return Math.max(1, Math.min(Math.floor(limit), 100));
  }

  private normalizeStreamMaxTeamActiveSessions() {
    const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM);
    if (!Number.isFinite(limit)) return 50;
    return Math.max(1, Math.min(Math.floor(limit), 500));
  }
}
