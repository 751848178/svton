import { Injectable } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import type { AlertEventRecord } from './monitoring-alert-event.types';
import { riskFromAlertSeverity } from './monitoring-alert-risk.utils';

type AlertAuditRule = { id: string; name: string } | null;

type AlertAuditEvent = {
  id: string;
  category: string;
  metric: string;
  severity: string;
  status: string;
  summary: string | null;
  projectId: string | null;
  environmentId: string | null;
  applicationId: string | null;
  applicationServiceId: string | null;
  serverId: string | null;
  siteId: string | null;
  managedResourceId: string | null;
};

@Injectable()
export class MonitoringAlertEventAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  async writeAlertAudit(
    teamId: string,
    userId: string | null,
    rule: AlertAuditRule,
    event: AlertAuditEvent,
    action = 'alert.evaluate',
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      alertEventId: event.id,
      category: 'alert',
      action,
      targetType: 'alert_event',
      targetId: event.id,
      risk: riskFromAlertSeverity(event.severity),
      status: event.status,
      summary: event.summary || `告警事件 ${event.status}`,
      metadata: {
        ruleId: rule?.id,
        ruleName: rule?.name,
        alertCategory: event.category,
        metric: event.metric,
        severity: event.severity,
      },
    });
  }

  async writeDedupedAudit(
    teamId: string,
    userId: string | null,
    rule: AlertAuditRule,
    event: AlertEventRecord,
    eventStatus: string,
    summary: string,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      alertEventId: event.id,
      category: 'alert',
      action: 'alert.evaluate.deduped',
      targetType: 'alert_event',
      targetId: event.id,
      risk: riskFromAlertSeverity(event.severity),
      status: eventStatus,
      summary: `告警事件已去重：${summary}`,
      metadata: {
        ruleId: rule?.id,
        ruleName: rule?.name,
        alertCategory: event.category,
        metric: event.metric,
        severity: event.severity,
        dedupedEventId: event.id,
      },
    });
  }
}
