import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import type {
  AlertNotificationDeliveryContext,
  AlertNotificationPayloadEvent,
  GenericAlertNotificationPayload,
} from "./monitoring-notification-delivery-payload.types";

export function buildGenericAlertNotificationPayload(
  channel: AlertNotificationChannelDispatchRecord,
  event: AlertNotificationPayloadEvent,
  context: AlertNotificationDeliveryContext = {},
): GenericAlertNotificationPayload {
  return {
    type:
      context.kind === "escalation"
        ? "devpilot.alert_event.escalation"
        : "devpilot.alert_event",
    channel: {
      id: channel.id,
      name: channel.name,
      type: channel.type,
    },
    escalation: context.escalation || null,
    alertEvent: {
      id: event.id,
      category: event.category,
      metric: event.metric,
      severity: event.severity,
      status: event.status,
      summary: event.summary,
      occurredAt: event.occurredAt.toISOString(),
    },
    rule: event.rule
      ? {
          id: event.rule.id,
          name: event.rule.name,
          metric: event.rule.metric,
          severity: event.rule.severity,
          enabled: event.rule.enabled,
        }
      : null,
    scope: {
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      backupPlanId: event.backupPlanId,
    },
    target: {
      project: event.project
        ? { id: event.project.id, name: event.project.name }
        : null,
      environment: event.environment
        ? {
            id: event.environment.id,
            key: event.environment.key,
            name: event.environment.name,
          }
        : null,
      applicationService: event.applicationService
        ? {
            id: event.applicationService.id,
            name: event.applicationService.name,
          }
        : null,
      server: event.server
        ? {
            id: event.server.id,
            name: event.server.name,
            host: event.server.host,
          }
        : null,
      site: event.site
        ? {
            id: event.site.id,
            name: event.site.name,
            primaryDomain: event.site.primaryDomain,
          }
        : null,
      managedResource: event.managedResource
        ? { id: event.managedResource.id, name: event.managedResource.name }
        : null,
      backupPlan: event.backupPlan
        ? { id: event.backupPlan.id, name: event.backupPlan.name }
        : null,
    },
  };
}
