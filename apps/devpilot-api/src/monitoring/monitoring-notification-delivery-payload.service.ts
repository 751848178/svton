import { Injectable } from "@nestjs/common";
import { normalizeNotificationChannelType } from "./monitoring-notification-channel.utils";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import type {
  AlertEmailPayload,
  AlertNotificationDeliveryContext,
  AlertNotificationPayloadEvent,
  GenericAlertNotificationPayload,
} from "./monitoring-notification-delivery-payload.types";
import { buildGenericAlertNotificationPayload } from "./monitoring-notification-delivery-payload.utils";

@Injectable()
export class MonitoringNotificationDeliveryPayloadService {
  buildAlertNotificationPayload(
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationPayloadEvent,
    context: AlertNotificationDeliveryContext = {},
  ): Record<string, unknown> {
    const payload = buildGenericAlertNotificationPayload(
      channel,
      event,
      context,
    );
    const channelType = normalizeNotificationChannelType(channel.type);
    if (channelType === "feishu") {
      return {
        msg_type: "text",
        content: {
          text: this.buildAlertNotificationText(payload),
        },
      };
    }
    if (channelType === "dingtalk") {
      return {
        msgtype: "markdown",
        markdown: {
          title: this.buildAlertNotificationTitle(payload),
          text: this.buildAlertNotificationMarkdown(payload),
        },
      };
    }
    if (channelType === "wecom") {
      return {
        msgtype: "markdown",
        markdown: {
          content: this.buildAlertNotificationMarkdown(payload),
        },
      };
    }
    return payload;
  }

  buildAlertEmailPayload(
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationPayloadEvent,
    recipients: string[],
    subjectPrefix: string,
    target: string,
    context: AlertNotificationDeliveryContext = {},
  ): AlertEmailPayload {
    const payload = buildGenericAlertNotificationPayload(
      channel,
      event,
      context,
    );
    const title = this.buildAlertNotificationTitle(payload);
    return {
      subject: `[${subjectPrefix}] ${title}`,
      text: this.buildAlertNotificationText(payload),
      to: recipients,
      target,
    };
  }

  private buildAlertNotificationTitle(
    payload: GenericAlertNotificationPayload,
  ) {
    const ruleName = payload.rule?.name || payload.alertEvent.metric;
    const prefix = payload.escalation ? "Devpilot ESCALATED" : "Devpilot";
    return `${prefix} ${payload.alertEvent.severity}/${payload.alertEvent.status}: ${ruleName}`;
  }

  private buildAlertNotificationText(payload: GenericAlertNotificationPayload) {
    return [
      this.buildAlertNotificationTitle(payload),
      payload.alertEvent.summary ? `摘要: ${payload.alertEvent.summary}` : null,
      payload.escalation ? `升级: ${payload.escalation.reason}` : null,
      `分类: ${payload.alertEvent.category}/${payload.alertEvent.metric}`,
      `时间: ${payload.alertEvent.occurredAt}`,
      this.buildAlertNotificationTargetText(payload),
      `事件: ${payload.alertEvent.id}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildAlertNotificationMarkdown(
    payload: GenericAlertNotificationPayload,
  ) {
    return [
      `### ${this.buildAlertNotificationTitle(payload)}`,
      payload.alertEvent.summary
        ? `- 摘要: ${payload.alertEvent.summary}`
        : null,
      payload.escalation ? `- 升级: ${payload.escalation.reason}` : null,
      `- 分类: ${payload.alertEvent.category}/${payload.alertEvent.metric}`,
      `- 时间: ${payload.alertEvent.occurredAt}`,
      `- ${this.buildAlertNotificationTargetText(payload)}`,
      `- 事件: ${payload.alertEvent.id}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildAlertNotificationTargetText(
    payload: GenericAlertNotificationPayload,
  ) {
    const target = payload.target;
    const name =
      target.applicationService?.name ||
      target.server?.name ||
      target.site?.name ||
      target.managedResource?.name ||
      target.backupPlan?.name ||
      target.project?.name ||
      "未绑定目标";
    const project = target.project?.name
      ? `项目: ${target.project.name}`
      : null;
    const environment = target.environment?.name
      ? `环境: ${target.environment.name}`
      : null;
    return [`目标: ${name}`, project, environment].filter(Boolean).join(" · ");
  }
}
