import { Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import type { AlertEventRecord } from "./monitoring-alert-event.types";
import type { AlertNotificationDeliveryRecord } from "./monitoring-notification-delivery.types";

@Injectable()
export class MonitoringNotificationRetryAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  async writeRetryAudit(
    teamId: string,
    userId: string | null,
    event: AlertEventRecord,
    delivery: AlertNotificationDeliveryRecord,
    sourceDeliveryId: string,
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
      category: "alert",
      action: "alert.notification.retry",
      targetType: "alert_notification_delivery",
      targetId: delivery.id,
      risk: "low",
      status: delivery.status,
      summary: `重试告警通知投递：${delivery.status}`,
      metadata: {
        sourceDeliveryId,
        channelId: delivery.channelId,
        channelType: delivery.channelType,
        dryRun: delivery.dryRun,
        target: delivery.target,
        responseStatus: delivery.responseStatus,
        alertEventId: event.id,
        alertStatus: event.status,
        alertSeverity: event.severity,
      },
    });
  }
}
