export type AlertNotificationDeliveryContext = {
  kind?: "alert" | "escalation";
  escalation?: {
    level: string;
    reason: string;
    staleMinutes: number;
    escalatedAt: string;
  };
};

export type AlertEmailPayload = {
  subject: string;
  text: string;
  to: string[];
  target: string;
};

export type AlertNotificationPayloadEvent = {
  id: string;
  category: string;
  metric: string;
  severity: string;
  status: string;
  summary?: string | null;
  occurredAt: Date;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  backupPlanId?: string | null;
  rule?: {
    id: string;
    name: string;
    metric: string;
    severity: string;
    enabled: boolean;
  } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string } | null;
  applicationService?: { id: string; name: string } | null;
  server?: { id: string; name: string; host?: string | null } | null;
  site?: { id: string; name: string; primaryDomain?: string | null } | null;
  managedResource?: { id: string; name: string } | null;
  backupPlan?: { id: string; name: string } | null;
};

export type GenericAlertNotificationPayload = {
  type: "devpilot.alert_event" | "devpilot.alert_event.escalation";
  channel: { id: string; name: string; type: string };
  escalation: AlertNotificationDeliveryContext["escalation"] | null;
  alertEvent: {
    id: string;
    category: string;
    metric: string;
    severity: string;
    status: string;
    summary?: string | null;
    occurredAt: string;
  };
  rule: AlertNotificationPayloadEvent["rule"] | null;
  scope: {
    projectId?: string | null;
    environmentId?: string | null;
    applicationId?: string | null;
    applicationServiceId?: string | null;
    serverId?: string | null;
    siteId?: string | null;
    managedResourceId?: string | null;
    backupPlanId?: string | null;
  };
  target: {
    project: AlertNotificationPayloadEvent["project"] | null;
    environment: AlertNotificationPayloadEvent["environment"] | null;
    applicationService:
      | AlertNotificationPayloadEvent["applicationService"]
      | null;
    server: AlertNotificationPayloadEvent["server"] | null;
    site: AlertNotificationPayloadEvent["site"] | null;
    managedResource: AlertNotificationPayloadEvent["managedResource"] | null;
    backupPlan: AlertNotificationPayloadEvent["backupPlan"] | null;
  };
};
