import { Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import type { AlertEventRecord } from "./monitoring-alert-event.types";
import { riskFromAlertSeverity } from "./monitoring-alert-risk.utils";
import type { AlertNotificationDeliveryContext } from "./monitoring-notification-delivery-payload.types";
import type { AlertNotificationDeliveryRecord } from "./monitoring-notification-delivery.types";

@Injectable()
export class MonitoringAlertEscalationAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  async writeEscalationAudit(
    teamId: string,
    event: AlertEventRecord,
    delivery: AlertNotificationDeliveryRecord,
    context: AlertNotificationDeliveryContext,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: null,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      alertEventId: event.id,
      category: "alert",
      action: "alert.escalate",
      targetType: "alert_notification_delivery",
      targetId: delivery.id,
      risk: riskFromAlertSeverity(event.severity),
      status: delivery.status,
      summary: `告警升级通知投递：${delivery.status}`,
      metadata: {
        alertEventId: event.id,
        alertStatus: event.status,
        alertSeverity: event.severity,
        channelId: delivery.channelId,
        channelType: delivery.channelType,
        deliveryId: delivery.id,
        dryRun: delivery.dryRun,
        escalation: context.escalation || null,
      },
    });
  }
}
