import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAlertEventsQueryDto } from "./dto/monitoring.dto";
import { alertEventInclude } from "./monitoring-alert-event.constants";
import { MonitoringAlertEventAuditService } from "./monitoring-alert-event-audit.service";

@Injectable()
export class MonitoringAlertEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertEventAuditService: MonitoringAlertEventAuditService,
  ) {}

  listEvents(teamId: string, query: ListAlertEventsQueryDto) {
    const where: Prisma.AlertEventWhereInput = { teamId };
    if (query.ruleId) where.ruleId = query.ruleId;
    if (query.category) where.category = query.category;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.alertEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: alertEventInclude,
    });
  }

  async getAccessScope(teamId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id: eventId, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!event) throw new NotFoundException("告警事件不存在");

    return {
      projectId: event.projectId,
      environmentId: event.environmentId,
    };
  }

  async acknowledgeEvent(teamId: string, userId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id: eventId, teamId },
      include: alertEventInclude,
    });

    if (!event) throw new NotFoundException("告警事件不存在");

    const acknowledged = await this.prisma.alertEvent.update({
      where: { id: event.id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
      },
      include: alertEventInclude,
    });

    await this.alertEventAuditService.writeAlertAudit(
      teamId,
      userId,
      acknowledged.rule || null,
      acknowledged,
      "alert.acknowledge",
    );
    return acknowledged;
  }
}
