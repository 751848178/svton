import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { alertEventInclude } from "./monitoring-alert-event.constants";
import { MonitoringAlertEscalationAuditService } from "./monitoring-alert-escalation-audit.service";
import type {
  AlertEscalationOptions,
  AlertEscalationSummary,
} from "./monitoring-alert-escalation.types";
import {
  isAlertEscalationPayload,
  normalizeAlertEscalationSeverities,
} from "./monitoring-alert-escalation.utils";
import { alertNotificationChannelDispatchSelect } from "./monitoring-notification-channel.constants";
import { MonitoringNotificationDeliveryDispatchService } from "./monitoring-notification-delivery-dispatch.service";
import type { AlertNotificationDeliveryContext } from "./monitoring-notification-delivery-payload.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertEscalationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escalationAuditService: MonitoringAlertEscalationAuditService,
    private readonly notificationDeliveryDispatchService: MonitoringNotificationDeliveryDispatchService,
  ) {}

  async escalateStaleAlertEvents(
    options: AlertEscalationOptions = {},
  ): Promise<AlertEscalationSummary> {
    const now = options.now || new Date();
    const batchSize = readPositiveInt(options.batchSize, 20, 1, 100);
    const minAgeSeconds = readPositiveInt(
      options.minAgeSeconds,
      1800,
      60,
      7 * 24 * 60 * 60,
    );
    const dedupeWindowMinutes = readPositiveInt(
      options.dedupeWindowMinutes,
      120,
      5,
      10080,
    );
    const severities = normalizeAlertEscalationSeverities(options.severities);
    const staleBefore = new Date(now.getTime() - minAgeSeconds * 1000);
    const dedupeSince = new Date(
      now.getTime() - dedupeWindowMinutes * 60 * 1000,
    );
    const events = await this.prisma.alertEvent.findMany({
      where: {
        status: { in: ["firing", "error"] },
        severity: { in: severities },
        acknowledgedAt: null,
        occurredAt: { lte: staleBefore },
      },
      orderBy: { occurredAt: "asc" },
      take: batchSize,
      include: alertEventInclude,
    });
    const summary: AlertEscalationSummary = {
      scanned: events.length,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNoChannels: 0,
      skippedAlreadyEscalated: 0,
    };

    for (const event of events) {
      const channels = await this.prisma.alertNotificationChannel.findMany({
        where: { teamId: event.teamId, status: "active" },
        select: alertNotificationChannelDispatchSelect,
      });
      const matchingChannels = channels.filter((channel) =>
        this.notificationDeliveryDispatchService.channelMatchesEvent(
          channel,
          event,
        ),
      );
      if (matchingChannels.length === 0) {
        summary.skippedNoChannels += 1;
        continue;
      }

      for (const channel of matchingChannels) {
        const duplicateEscalation = await this.findRecentEscalationDelivery(
          event.teamId,
          event.id,
          channel.id,
          dedupeSince,
        );
        if (duplicateEscalation) {
          summary.skippedAlreadyEscalated += 1;
          continue;
        }

        const context = this.buildEscalationContext(event.occurredAt, now);
        summary.attempted += 1;
        try {
          const delivery =
            await this.notificationDeliveryDispatchService.deliverAlertNotification(
              event.teamId,
              channel,
              event,
              context,
            );
          await this.escalationAuditService.writeEscalationAudit(
            event.teamId,
            event,
            delivery,
            context,
          );
          summary.completed += 1;
        } catch {
          summary.failed += 1;
        }
      }
    }

    return summary;
  }

  private async findRecentEscalationDelivery(
    teamId: string,
    alertEventId: string,
    channelId: string,
    since: Date,
  ) {
    const deliveries = await this.prisma.alertNotificationDelivery.findMany({
      where: {
        teamId,
        alertEventId,
        channelId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        requestPayload: true,
      },
    });
    return (
      deliveries.find((delivery) =>
        isAlertEscalationPayload(delivery.requestPayload),
      ) || null
    );
  }

  private buildEscalationContext(
    occurredAt: Date,
    now: Date,
  ): AlertNotificationDeliveryContext {
    const staleMinutes = Math.max(
      0,
      Math.floor((now.getTime() - occurredAt.getTime()) / 60000),
    );
    return {
      kind: "escalation",
      escalation: {
        level: "critical_unacknowledged",
        reason: `告警已持续 ${staleMinutes} 分钟未确认`,
        staleMinutes,
        escalatedAt: now.toISOString(),
      },
    };
  }
}
