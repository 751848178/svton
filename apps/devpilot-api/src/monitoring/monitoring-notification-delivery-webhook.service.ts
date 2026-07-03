import { Injectable } from "@nestjs/common";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import { MonitoringNotificationDeliveryConfigService } from "./monitoring-notification-delivery-config.service";
import type { AlertNotificationDispatchEvent } from "./monitoring-notification-delivery-dispatch.types";
import { MonitoringNotificationDeliveryPayloadService } from "./monitoring-notification-delivery-payload.service";
import type { AlertNotificationDeliveryContext } from "./monitoring-notification-delivery-payload.types";
import { MonitoringNotificationDeliveryWriterService } from "./monitoring-notification-delivery-writer.service";

@Injectable()
export class MonitoringNotificationDeliveryWebhookService {
  constructor(
    private readonly config: MonitoringNotificationDeliveryConfigService,
    private readonly payloadService: MonitoringNotificationDeliveryPayloadService,
    private readonly writer: MonitoringNotificationDeliveryWriterService,
  ) {}

  async deliverAlertWebhookNotification(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    context: AlertNotificationDeliveryContext = {},
  ) {
    const secretConfig = this.asRecord(channel.secretConfig);
    const webhookUrl = this.config.readString(secretConfig.webhookUrl);
    const target = webhookUrl
      ? this.config.safeWebhookTarget(webhookUrl)
      : undefined;
    const payload = this.payloadService.buildAlertNotificationPayload(
      channel,
      event,
      context,
    );
    const now = new Date();

    if (!webhookUrl) {
      const delivery = await this.writer.createNotificationDelivery(
        teamId,
        channel,
        event,
        {
          status: "failed",
          dryRun: true,
          target,
          payload,
          error: "Webhook URL is not configured",
          attemptedAt: now,
        },
      );
      await this.writer.updateChannelLastStatus(
        channel.id,
        "failed",
        now,
        "Webhook URL is not configured",
      );
      return delivery;
    }

    if (!this.config.webhooksEnabled()) {
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
      await this.writer.updateChannelLastStatus(
        channel.id,
        "planned",
        now,
        null,
      );
      return delivery;
    }

    return this.postWebhook(
      teamId,
      channel,
      event,
      webhookUrl,
      target,
      payload,
      now,
    );
  }

  private async postWebhook(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    webhookUrl: string,
    target: string | undefined,
    payload: Record<string, unknown>,
    attemptedAt: Date,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.webhookTimeoutMs(),
    );

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "svton-devpilot-alert-webhook",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responseBody = this.truncate(await response.text(), 2000);
      const status = response.ok ? "sent" : "failed";
      const error = response.ok
        ? null
        : `Webhook returned HTTP ${response.status}`;
      const delivery = await this.writer.createNotificationDelivery(
        teamId,
        channel,
        event,
        {
          status,
          dryRun: false,
          target,
          payload,
          responseStatus: response.status,
          responseBody,
          error,
          attemptedAt,
        },
      );
      await this.writer.updateChannelLastStatus(
        channel.id,
        status,
        attemptedAt,
        error,
      );
      return delivery;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Webhook request failed";
      const delivery = await this.writer.createNotificationDelivery(
        teamId,
        channel,
        event,
        {
          status: "failed",
          dryRun: false,
          target,
          payload,
          error: message,
          attemptedAt,
        },
      );
      await this.writer.updateChannelLastStatus(
        channel.id,
        "failed",
        attemptedAt,
        message,
      );
      return delivery;
    } finally {
      clearTimeout(timeout);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
