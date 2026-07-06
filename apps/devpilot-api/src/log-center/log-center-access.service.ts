import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ListLogStatsQueryDto } from "./dto/log-center.dto";
import { LogCenterService } from "./log-center.service";
import {
  AuthRequest,
  ReadableLogRecord,
  ReadableLogSession,
} from "./log-center-controller.types";

@Injectable()
export class LogCenterAccessService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly logCenterService: LogCenterService,
  ) {}

  assertCanWriteLog(
    req: AuthRequest,
    action: string,
    streamId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = "low",
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: "log",
      action,
      targetType: "log_stream",
      targetId: streamId,
      risk,
    });
  }

  assertCanReadLog(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = "log_stream",
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: "log",
      action,
      targetType,
      targetId,
      risk: "low",
    });
  }

  async filterReadableLogRecords<T extends ReadableLogRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(
      records.map(async (record) => ({
        record,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: record.projectId ?? record.stream?.projectId ?? null,
          environmentId:
            record.environmentId ?? record.stream?.environmentId ?? null,
          category: "log",
          action,
          targetType,
          targetId: record.id,
          risk: "low",
        }),
      })),
    );

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  async filterReadableLogSessions(
    req: AuthRequest,
    sessions: ReadableLogSession[],
  ) {
    const allowed = await Promise.all(
      sessions.map(async (session) => ({
        session,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: session.projectId,
          environmentId: session.environmentId,
          category: "log",
          action: "log.stream.tail",
          targetType: "log_stream",
          targetId: session.streamId,
          risk: "low",
        }),
      })),
    );

    return allowed.filter((item) => item.allowed).map((item) => item.session);
  }

  async resolveReadableStreamIdsForStats(
    req: AuthRequest,
    query: ListLogStatsQueryDto,
  ) {
    if (query.streamId) {
      const scope = await this.logCenterService.getStreamAccessScope(
        req.teamId,
        query.streamId,
      );
      await this.assertCanReadLog(
        req,
        "log.stream.read",
        query.streamId,
        scope.projectId,
        scope.environmentId,
        "log_stream",
      );
      return [query.streamId];
    }

    const streams = await this.logCenterService.listStreams(req.teamId, query);
    const readableStreams = await this.filterReadableLogRecords(
      req,
      streams,
      "log.stream.read",
      "log_stream",
    );
    return readableStreams.map((stream) => stream.id);
  }
}
