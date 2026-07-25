import { Injectable } from "@nestjs/common";
import { normalizeNotificationChannelType } from "./monitoring-notification-channel.utils";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import { MonitoringNotificationDeliveryConfigService } from "./monitoring-notification-delivery-config.service";
import { buildAlertDeepLink } from "./monitoring-notification-deep-link.utils";
import type {
  AlertEmailPayload,
  AlertNotificationDeliveryContext,
  AlertNotificationPayloadEvent,
  GenericAlertNotificationPayload,
} from "./monitoring-notification-delivery-payload.types";
import { buildGenericAlertNotificationPayload } from "./monitoring-notification-delivery-payload.utils";

@Injectable()
export class MonitoringNotificationDeliveryPayloadService {
  constructor(
    private readonly config: MonitoringNotificationDeliveryConfigService,
  ) {}

  buildAlertNotificationPayload(
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationPayloadEvent,
    context: AlertNotificationDeliveryContext = {},
  ): Record<string, unknown> {
    const payload = buildGenericAlertNotificationPayload(
      channel,
      event,
      context,
      buildAlertDeepLink(this.config.webBaseUrl(), event),
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
    const actionUrl = buildAlertDeepLink(this.config.webBaseUrl(), event);
    const payload = buildGenericAlertNotificationPayload(
      channel,
      event,
      context,
      actionUrl,
    );
    const title = this.buildAlertNotificationTitle(payload);
    const text = this.buildAlertNotificationText(payload);
    return {
      subject: `[${subjectPrefix}] ${title}`,
      text,
      html: actionUrl ? this.buildAlertEmailHtml(text, actionUrl) : null,
      actionUrl,
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
      payload.actionUrl ? `查看: ${payload.actionUrl}` : null,
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
      payload.actionUrl ? `- [查看详情](${payload.actionUrl})` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * N5:邮件正文渲染为可点击的 HTML 链接(仅有深链时启用)。
   * 对 text 做最小转义,避免基础 HTML 注入;深链 URL 已由 builder 构造为受信绝对 URL。
   */
  private buildAlertEmailHtml(text: string, actionUrl: string) {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const safeUrl = this.escapeHtmlAttribute(actionUrl);
    return `<pre style="white-space:pre-wrap;word-break:break-word">${escaped}</pre>\n<p><a href="${safeUrl}">查看详情</a></p>`;
  }

  private escapeHtmlAttribute(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
