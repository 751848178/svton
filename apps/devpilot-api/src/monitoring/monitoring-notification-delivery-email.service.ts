import { Injectable } from "@nestjs/common";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import { MonitoringNotificationDeliveryConfigService } from "./monitoring-notification-delivery-config.service";
import type { AlertNotificationDispatchEvent } from "./monitoring-notification-delivery-dispatch.types";
import { MonitoringNotificationDeliveryEmailSenderService } from "./monitoring-notification-delivery-email-sender.service";
import { MonitoringNotificationDeliveryPayloadService } from "./monitoring-notification-delivery-payload.service";
import type {
  AlertEmailPayload,
  AlertNotificationDeliveryContext,
} from "./monitoring-notification-delivery-payload.types";
import { MonitoringNotificationDeliveryWriterService } from "./monitoring-notification-delivery-writer.service";

@Injectable()
export class MonitoringNotificationDeliveryEmailService {
  constructor(
    private readonly config: MonitoringNotificationDeliveryConfigService,
    private readonly emailSender: MonitoringNotificationDeliveryEmailSenderService,
    private readonly payloadService: MonitoringNotificationDeliveryPayloadService,
    private readonly writer: MonitoringNotificationDeliveryWriterService,
  ) {}

  async deliverAlertEmailNotification(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    context: AlertNotificationDeliveryContext = {},
  ) {
    const secretConfig = this.asRecord(channel.secretConfig);
    const recipients = this.config.readEmailRecipients(
      secretConfig.emailRecipients,
    );
    const subjectPrefix =
      this.config.readString(secretConfig.emailSubjectPrefix) ||
      "Devpilot Alert";
    const target = this.config.safeEmailTarget(recipients);
    const payload = this.payloadService.buildAlertEmailPayload(
      channel,
      event,
      recipients,
      subjectPrefix,
      target,
      context,
    );
    const now = new Date();

    if (recipients.length === 0) {
      return this.finishFailure(
        teamId,
        channel,
        event,
        target,
        payload,
        now,
        true,
        "Email recipients are not configured",
      );
    }
    if (!this.config.emailEnabled()) {
      return this.finishPlanned(teamId, channel, event, target, payload, now);
    }

    const smtp = this.config.smtpConfig();
    if (!smtp.host || !smtp.from) {
      return this.finishFailure(
        teamId,
        channel,
        event,
        target,
        payload,
        now,
        false,
        "SMTP host/from is not configured",
      );
    }

    const sendResult = await this.emailSender.sendEmail(payload, smtp);
    const delivery = await this.writer.createNotificationDelivery(
      teamId,
      channel,
      event,
      {
        status: sendResult.sent ? "sent" : "failed",
        dryRun: false,
        target: payload.target,
        payload,
        responseBody: sendResult.responseBody,
        error: sendResult.error,
        attemptedAt: now,
      },
    );
    await this.writer.updateChannelLastStatus(
      channel.id,
      sendResult.sent ? "sent" : "failed",
      now,
      sendResult.error || null,
    );
    return delivery;
  }

  private async finishPlanned(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    target: string,
    payload: AlertEmailPayload,
    now: Date,
  ) {
    const delivery = await this.writer.createNotificationDelivery(
      teamId,
      channel,
      event,
      {
        status: "planned",
        dryRun: true,
        target,
        payload,
        attemptedAt: undefined,
      },
    );
    await this.writer.updateChannelLastStatus(channel.id, "planned", now, null);
    return delivery;
  }

  private async finishFailure(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    target: string,
    payload: AlertEmailPayload,
    attemptedAt: Date,
    dryRun: boolean,
    error: string,
  ) {
    const delivery = await this.writer.createNotificationDelivery(
      teamId,
      channel,
      event,
      {
        status: "failed",
        dryRun,
        target,
        payload,
        error,
        attemptedAt,
      },
    );
    await this.writer.updateChannelLastStatus(
      channel.id,
      "failed",
      attemptedAt,
      error,
    );
    return delivery;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
