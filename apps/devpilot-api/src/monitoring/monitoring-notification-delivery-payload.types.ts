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
  /** 当存在深链时,渲染为可点击的 HTML 链接;为空则保持纯文本邮件。 */
  html?: string | null;
  /** N5:告警→日志/部署详情的绝对 URL;为空表示该告警无可直达的目标。 */
  actionUrl?: string | null;
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
  /**
   * 评估服务写入的评估值(N5 深链读取来源)。
   * 对齐 Prisma `AlertEvent.value`(Json? 列),实际可能是任意 JSON;
   * 深链构建器在运行时按对象形状解析,故此处置宽为 unknown。
   */
  value?: unknown;
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
  /** N5:告警→日志/部署详情的绝对 URL;为空表示该告警无可直达的目标。 */
  actionUrl?: string | null;
};
