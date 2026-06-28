import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditEventsQueryDto } from './dto/audit-event.dto';

export type CreateAuditEventInput = {
  teamId: string;
  actorId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  resourceActionRunId?: string | null;
  resourceConnectionRunId?: string | null;
  resourceQueryRunId?: string | null;
  siteSyncRunId?: string | null;
  applicationServiceOperationRunId?: string | null;
  operationApprovalId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
  logStreamId?: string | null;
  logEntryId?: string | null;
  logCollectionRunId?: string | null;
  logRetentionRunId?: string | null;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk?: string;
  status?: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | Prisma.InputJsonValue | null;
  occurredAt?: Date;
};

@Injectable()
export class AuditEventService {
  constructor(private readonly prisma: PrismaService) {}

  async list(teamId: string, query: ListAuditEventsQueryDto) {
    const where: Prisma.AuditEventWhereInput = { teamId };

    if (query.actorId) where.actorId = query.actorId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.applicationServiceId) where.applicationServiceId = query.applicationServiceId;
    if (query.serverId) where.serverId = query.serverId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.managedResourceId) where.managedResourceId = query.managedResourceId;
    if (query.backupRunId) where.backupRunId = query.backupRunId;
    if (query.alertEventId) where.alertEventId = query.alertEventId;
    if (query.logStreamId) where.logStreamId = query.logStreamId;
    if (query.logEntryId) where.logEntryId = query.logEntryId;
    if (query.logCollectionRunId) where.logCollectionRunId = query.logCollectionRunId;
    if (query.logRetentionRunId) where.logRetentionRunId = query.logRetentionRunId;
    if (query.resourceConnectionRunId) where.resourceConnectionRunId = query.resourceConnectionRunId;
    if (query.resourceQueryRunId) where.resourceQueryRunId = query.resourceQueryRunId;
    if (query.siteSyncRunId) where.siteSyncRunId = query.siteSyncRunId;
    if (query.category) where.category = query.category;
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;
    if (query.status) where.status = query.status;
    if (query.risk) where.risk = query.risk;

    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100,
      include: this.auditEventInclude(),
    });
  }

  async create(input: CreateAuditEventInput) {
    return this.prisma.auditEvent.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId ?? undefined,
        projectId: input.projectId ?? undefined,
        environmentId: input.environmentId ?? undefined,
        applicationId: input.applicationId ?? undefined,
        applicationServiceId: input.applicationServiceId ?? undefined,
        serverId: input.serverId ?? undefined,
        siteId: input.siteId ?? undefined,
        managedResourceId: input.managedResourceId ?? undefined,
        deploymentRunId: input.deploymentRunId ?? undefined,
        resourceActionRunId: input.resourceActionRunId ?? undefined,
        resourceConnectionRunId: input.resourceConnectionRunId ?? undefined,
        resourceQueryRunId: input.resourceQueryRunId ?? undefined,
        siteSyncRunId: input.siteSyncRunId ?? undefined,
        applicationServiceOperationRunId: input.applicationServiceOperationRunId ?? undefined,
        operationApprovalId: input.operationApprovalId ?? undefined,
        backupRunId: input.backupRunId ?? undefined,
        alertEventId: input.alertEventId ?? undefined,
        logStreamId: input.logStreamId ?? undefined,
        logEntryId: input.logEntryId ?? undefined,
        logCollectionRunId: input.logCollectionRunId ?? undefined,
        logRetentionRunId: input.logRetentionRunId ?? undefined,
        category: input.category,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? undefined,
        risk: input.risk || 'low',
        status: input.status || 'completed',
        summary: input.summary ?? undefined,
        metadata: input.metadata !== undefined && input.metadata !== null
          ? this.toJsonValue(input.metadata)
          : undefined,
        occurredAt: input.occurredAt,
      },
      include: this.auditEventInclude(),
    });
  }

  private auditEventInclude(): Prisma.AuditEventInclude {
    return {
      actor: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      application: { select: { id: true, name: true, status: true } },
      applicationService: { select: { id: true, name: true, kind: true, runtime: true } },
      server: { select: { id: true, name: true, host: true } },
      site: { select: { id: true, name: true, primaryDomain: true } },
      managedResource: {
        select: { id: true, name: true, sourceType: true, provider: true, kind: true, endpoint: true },
      },
      deploymentRun: { select: { id: true, source: true, trigger: true, status: true } },
      resourceActionRun: { select: { id: true, action: true, status: true, dryRun: true } },
      resourceConnectionRun: { select: { id: true, provider: true, kind: true, status: true, dryRun: true } },
      resourceQueryRun: { select: { id: true, provider: true, kind: true, queryType: true, status: true, dryRun: true } },
      siteSyncRun: { select: { id: true, mode: true, status: true, dryRun: true, targetConfigPath: true } },
      applicationServiceOperationRun: {
        select: { id: true, action: true, status: true, dryRun: true },
      },
      operationApproval: { select: { id: true, action: true, status: true, risk: true } },
      backupRun: { select: { id: true, backupType: true, status: true, dryRun: true } },
      alertEvent: { select: { id: true, metric: true, severity: true, status: true } },
      logStream: { select: { id: true, name: true, sourceType: true, status: true } },
      logEntry: { select: { id: true, level: true, message: true, timestamp: true } },
      logCollectionRun: { select: { id: true, sourceType: true, status: true, dryRun: true } },
      logRetentionRun: {
        select: {
          id: true,
          streamId: true,
          status: true,
          dryRun: true,
          matchedEntryCount: true,
          deletedEntryCount: true,
          cutoffAt: true,
        },
      },
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
