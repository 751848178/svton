import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { SseFrameWriter, SSE_HEADERS } from './sse-frame-writer';

/**
 * SSE 会话管理器。
 *
 * 封装 log-center.controller 的 SSE 会话生命周期手搓：
 *  - SSE 响应头设置 + flushHeaders
 *  - 会话注册表（open/update/remove）的三级限流检查
 *  - cursor 管理 + 定时轮询回调
 *  - 会话超时（maxSessionMs）+ 连接关闭清理
 *  - 帧写入（ready/entries/heartbeat/error/closing）
 *
 * controller 通过 {@link SseSessionManager.start} 启动会话，
 * 传入 poll 回调（业务 tail 逻辑），manager 负责全部传输/会话/定时器细节。
 * 这消除了 controller 内散布的 response 流操作手搓，使 @Sse() 的替代方案完整。
 */

/** 会话限流配置。 */
export interface SseSessionLimits {
  pollIntervalMs: number;
  maxSessionMs: number;
  maxActiveSessions: number;
  maxActorActiveSessions: number;
  maxTeamActiveSessions: number;
}

/** 会话注册表端口（log-center 的 LogStreamSessionRegistry 实现）。 */
export interface SseSessionRegistry {
  countOpen(teamId: string, streamId?: string | null): number;
  countOpenByActor(teamId: string, actorId: string): number;
  open(session: SseSessionRecord, onExpire?: (reason?: string) => void): void;
  update(sessionId: string, patch: Partial<SseSessionRecord>): void;
  remove(sessionId: string): void;
}

export interface SseSessionRecord {
  id: string;
  teamId: string;
  streamId: string;
  actorId: string;
  projectId?: string;
  environmentId?: string;
  openedAt: string;
  expiresAt: string;
  maxSessionMs: number;
  pollIntervalMs: number;
  cursor: string | null;
  lastEventAt: string;
}

/** poll 回调：业务 tail 逻辑，返回新 cursor 和 entries。 */
export interface SsePollResult {
  cursor?: string | null;
  entries: unknown[];
  rawData?: Record<string, unknown>;
}

export type SsePollHandler = (cursor: string | null) => Promise<SsePollResult>;

export interface StartSessionParams {
  response: Response;
  teamId: string;
  actorId: string;
  streamId: string;
  projectId?: string | null;
  environmentId?: string | null;
  initialCursor: string | null;
  limits: SseSessionLimits;
  pollHandler: SsePollHandler;
}

export class SseSessionManager {
  constructor(private readonly registry: {
    countOpen(teamId: string, streamId?: string | null): number;
    countOpenByActor(teamId: string, actorId: string): number;
    open(session: Record<string, unknown>, onExpire?: (reason?: string) => void): void;
    update(sessionId: string, patch: Record<string, unknown>): void;
    remove(sessionId: string): void;
  }) {}

  /**
   * 启动一个 SSE 会话：设置 header、检查限流、注册会话、首次 poll、定时轮询、超时清理。
   *
   * async 是为了 await 首次 poll 完成（与原 controller 语义一致：streamTailEvents
   * 返回前首帧已写入）。定时器在 await 之后同步注册，确保 start 返回时已就绪——
   * 这使 jest.useFakeTimers + advanceTimersByTime 能可靠触发 expiry/poll 定时器，
   * 不依赖异步 IIFE 的微任务调度时序。
   *
   * 返回 sessionId、expiresAt，以及一个 close() 清理句柄——controller 应将其挂到
   * req.on('close') 以便客户端断开时停止定时器并注销会话。
   *
   * 限流拒绝时抛 SseSessionLimitError（controller 捕获转 BadRequestException）。
   */
  async start(params: StartSessionParams): Promise<{ sessionId: string; expiresAt: string; close: () => void }> {
    const { response, teamId, actorId, streamId, limits } = params;
    const { maxActiveSessions, maxActorActiveSessions, maxTeamActiveSessions } = limits;

    // 三级限流检查
    if (this.registry.countOpen(teamId, streamId) >= maxActiveSessions) {
      throw new SseSessionLimitError('日志流活跃会话已达上限，请关闭旧会话后重试');
    }
    if (this.registry.countOpenByActor(teamId, actorId) >= maxActorActiveSessions) {
      throw new SseSessionLimitError('当前用户日志流活跃会话已达上限，请关闭旧会话后重试');
    }
    if (this.registry.countOpen(teamId) >= maxTeamActiveSessions) {
      throw new SseSessionLimitError('团队日志流活跃会话已达上限，请关闭旧会话后重试');
    }

    const sessionId = randomUUID();
    const openedAt = new Date();
    const expiresAt = new Date(openedAt.getTime() + limits.maxSessionMs).toISOString();

    // 设置 SSE 响应头
    const res = response as Response & { flushHeaders?: () => void };
    res.status(200);
    res.set({
      'Content-Type': SSE_HEADERS.contentType,
      'Cache-Control': SSE_HEADERS.cacheControl,
      Connection: SSE_HEADERS.connection,
      'X-Accel-Buffering': SSE_HEADERS.xAccelBuffering,
      'X-Log-Stream-Session-Id': sessionId,
      'X-Log-Stream-Session-Expires-At': expiresAt,
      'X-Log-Stream-Max-Active-Sessions': String(maxActiveSessions),
      'X-Log-Stream-Max-Actor-Active-Sessions': String(maxActorActiveSessions),
      'X-Log-Stream-Max-Team-Active-Sessions': String(maxTeamActiveSessions),
    });
    res.flushHeaders?.();

    const frameWriter = new SseFrameWriter(res);
    let cursor = params.initialCursor;
    let polling = false;
    let closed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const writeEvent = (event: string, data: Record<string, unknown>, eventId?: string | null) => {
      if (closed || res.writableEnded) return;
      frameWriter.write({
        event,
        data: { ...data, sessionId, expiresAt, maxSessionMs: limits.maxSessionMs },
        id: eventId ?? undefined,
        retryMs: limits.pollIntervalMs,
      });
    };

    const close = () => {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      if (expiryTimer) clearTimeout(expiryTimer);
      this.registry.remove(sessionId);
    };

    const endSession = (reason: string = 'max_session_duration') => {
      if (closed || res.writableEnded) return;
      writeEvent('closing', { streamId, cursor, reason, at: new Date().toISOString() }, cursor);
      close();
      res.end();
    };

    const poll = async () => {
      if (polling || closed || res.writableEnded) return;
      polling = true;
      try {
        const result = await params.pollHandler(cursor);
        cursor = result.cursor ?? cursor;
        this.registry.update(sessionId, { cursor, lastEventAt: new Date().toISOString() });
        if (result.entries.length > 0) {
          writeEvent('entries', (result.rawData ?? { entries: result.entries }) as Record<string, unknown>, result.cursor ?? undefined);
        } else {
          writeEvent('heartbeat', { streamId, cursor, at: new Date().toISOString() }, cursor);
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

    // ready 事件 + 注册会话 + 首次 poll + 定时器
    writeEvent('ready', {
      streamId,
      cursor,
      pollIntervalMs: limits.pollIntervalMs,
      maxActiveSessions,
      maxActorActiveSessions,
      maxTeamActiveSessions,
      openedAt: openedAt.toISOString(),
      at: new Date().toISOString(),
    }, cursor);

    this.registry.open({
      id: sessionId,
      teamId,
      streamId,
      actorId,
      projectId: params.projectId,
      environmentId: params.environmentId,
      openedAt: openedAt.toISOString(),
      expiresAt,
      maxSessionMs: limits.maxSessionMs,
      pollIntervalMs: limits.pollIntervalMs,
      cursor,
      lastEventAt: openedAt.toISOString(),
    }, endSession);

    // await 首次 poll（让 ready + 首帧在 start 返回前写入），随后同步注册定时器。
    // 同步注册保证 start() resolve 时定时器已就绪，fake-timer 测试可立即 advance。
    await poll();
    timer = setInterval(poll, limits.pollIntervalMs);
    expiryTimer = setTimeout(endSession, limits.maxSessionMs);

    return { sessionId, expiresAt, close };
  }
}

/** 限流错误（controller 可捕获转为 BadRequestException）。 */
export class SseSessionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SseSessionLimitError';
  }
}
