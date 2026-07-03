import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AlertNotificationChannelDispatchRecord } from "./monitoring-notification-channel.types";
import { alertNotificationDeliveryInclude } from "./monitoring-notification-delivery.constants";
import type {
  AlertNotificationDeliveryWriteResult,
  AlertNotificationDispatchEvent,
} from "./monitoring-notification-delivery-dispatch.types";

@Injectable()
export class MonitoringNotificationDeliveryWriterService {
  constructor(private readonly prisma: PrismaService) {}

  createNotificationDelivery(
    teamId: string,
    channel: AlertNotificationChannelDispatchRecord,
    event: AlertNotificationDispatchEvent,
    result: AlertNotificationDeliveryWriteResult,
  ) {
    return this.prisma.alertNotificationDelivery.create({
      data: {
        teamId,
        channelId: channel.id,
        alertEventId: event.id,
        channelType: channel.type,
        status: result.status,
        dryRun: result.dryRun,
        target: result.target,
        requestPayload: this.toJsonValue(result.payload),
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        error: result.error,
        attemptedAt: result.attemptedAt,
      },
      include: alertNotificationDeliveryInclude,
    });
  }

  updateChannelLastStatus(
    channelId: string,
    lastStatus: string,
    lastDeliveredAt: Date,
    lastError: string | null,
  ) {
    return this.prisma.alertNotificationChannel.update({
      where: { id: channelId },
      data: { lastStatus, lastDeliveredAt, lastError },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
