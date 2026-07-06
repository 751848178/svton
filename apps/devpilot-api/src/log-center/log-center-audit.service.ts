import { Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";

type AuditLogStreamRecord = {
  id: string;
  name: string;
  sourceType: string;
  sourceKey?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
};

type AuditLogCollectionRunRecord = {
  id: string;
  status: string;
  dryRun: boolean;
  tail?: number | null;
  executorKey?: string | null;
  adapterKey?: string | null;
  error?: string | null;
};

type AuditLogRetentionRunRecord = {
  id: string;
  status: string;
  dryRun: boolean;
  retentionDays: number;
  cutoffAt: Date;
  matchedEntryCount: number;
  deletedEntryCount: number;
  error?: string | null;
};

@Injectable()
export class LogCenterAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  recordAppend(
    teamId: string,
    userId: string,
    stream: AuditLogStreamRecord,
    entry: { id: string; level: string; message: string },
    count: number,
  ) {
    return this.auditEventService.create({
      ...this.streamContext(teamId, userId, stream),
      logEntryId: entry.id,
      category: "log",
      action: "log.append",
      targetType: "log_stream",
      targetId: stream.id,
      risk:
        entry.level === "error" || entry.level === "fatal" ? "medium" : "low",
      status: "completed",
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

  recordCollection(
    teamId: string,
    userId: string | null,
    stream: AuditLogStreamRecord,
    run: AuditLogCollectionRunRecord,
  ) {
    return this.auditEventService.create({
      ...this.streamContext(teamId, userId, stream),
      logCollectionRunId: run.id,
      category: "log",
      action: "log.collect",
      targetType: "log_collection_run",
      targetId: run.id,
      risk: "low",
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

  recordRetention(
    teamId: string,
    userId: string | null,
    stream: AuditLogStreamRecord,
    run: AuditLogRetentionRunRecord,
  ) {
    return this.auditEventService.create({
      ...this.streamContext(teamId, userId, stream),
      logRetentionRunId: run.id,
      category: "log",
      action: "log.retention.cleanup",
      targetType: "log_retention_run",
      targetId: run.id,
      risk: run.dryRun ? "low" : "high",
      status: run.status,
      summary: `日志流 ${stream.name} 保留清理: ${run.dryRun ? "dry-run" : "live"} ${run.status}`,
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

  private streamContext(
    teamId: string,
    userId: string | null,
    stream: AuditLogStreamRecord,
  ) {
    return {
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
    };
  }
}
