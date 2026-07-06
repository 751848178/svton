import { Injectable, Optional } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import { AuthRequest } from "./log-center-controller.types";
import { LogStreamSessionRecord } from "./log-stream-session.registry";

@Injectable()
export class LogStreamSessionAuditService {
  constructor(
    @Optional()
    private readonly auditEventService?: AuditEventService,
  ) {}

  async recordManualClose(
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
      category: "log",
      action: "log.stream_session.close",
      targetType: "log_stream_session",
      targetId: session.id,
      risk: "low",
      status: "completed",
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
}
