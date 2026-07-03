import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { alertNotificationChannelDispatchSelect } from "./monitoring-notification-channel.constants";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import { normalizeNotificationChannelType } from "./monitoring-notification-channel.utils";
import { MonitoringNotificationDeliveryEmailService } from "./monitoring-notification-delivery-email.service";
import type { AlertNotificationDispatchEvent } from "./monitoring-notification-delivery-dispatch.types";
import type { AlertNotificationDeliveryContext } from "./monitoring-notification-delivery-payload.types";
import { MonitoringNotificationDeliveryWebhookService } from "./monitoring-notification-delivery-webhook.service";

@Injectable()
export class MonitoringNotificationDeliveryDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: MonitoringNotificationDeliveryEmailService,
    private readonly webhookService: MonitoringNotificationDeliveryWebhookService,
  ) {}

  async dispatchAlertNotifications(
    teamId: string,
    event: AlertNotificationDispatchEvent,
  ) {
    try {
      if (event.status === "suppressed") return;
      const channels = await this.prisma.alertNotificationChannel.findMany({
        where: { teamId, status: "active" },
        select: alertNotificationChannelDispatchSelect,
      });
      await Promise.all(
        channels
          .filter((channel) => this.channelMatchesEvent(channel, event))
          .map((channel) =>
            this.deliverAlertNotification(teamId, channel, event),
          ),
      );
    } catch {
      // Notification delivery must not break alert evaluation or audit writes.
    }
  }

  channelMatchesEvent(
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
  ) {
    if (channel.projectId && channel.projectId !== event.projectId)
      return false;
    if (channel.environmentId && channel.environmentId !== event.environmentId)
      return false;

    const eventStatuses = this.readStringArray(channel.eventStatuses);
    const allowedStatuses =
      eventStatuses.length > 0 ? eventStatuses : ["firing", "error"];
    if (!allowedStatuses.includes(event.status)) return false;

    const severityFilter = this.readStringArray(channel.severityFilter);
    return !(
      severityFilter.length > 0 && !severityFilter.includes(event.severity)
    );
  }

  deliverAlertNotification(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    context: AlertNotificationDeliveryContext = {},
  ) {
    const channelType = normalizeNotificationChannelType(channel.type);
    if (channelType === "email") {
      return this.emailService.deliverAlertEmailNotification(
        teamId,
        channel,
        event,
        context,
      );
    }
    return this.webhookService.deliverAlertWebhookNotification(
      teamId,
      channel,
      event,
      context,
    );
  }

  private readStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
  }
}
