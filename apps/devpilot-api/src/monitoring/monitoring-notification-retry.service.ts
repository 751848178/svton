import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { alertEventInclude } from "./monitoring-alert-event.constants";
import { alertNotificationChannelDispatchSelect } from "./monitoring-notification-channel.constants";
import { MonitoringNotificationDeliveryDispatchService } from "./monitoring-notification-delivery-dispatch.service";
import { MonitoringNotificationRetryAuditService } from "./monitoring-notification-retry-audit.service";
import type {
  AlertNotificationAutoRetryOptions,
  AlertNotificationAutoRetrySummary,
} from "./monitoring-notification-retry.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringNotificationRetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retryAuditService: MonitoringNotificationRetryAuditService,
    private readonly notificationDeliveryDispatchService: MonitoringNotificationDeliveryDispatchService,
  ) {}

  async retryNotificationDelivery(
    teamId: string,
    userId: string | null,
    deliveryId: string,
  ) {
    const sourceDelivery =
      await this.prisma.alertNotificationDelivery.findFirst({
        where: { id: deliveryId, teamId },
        select: {
          id: true,
          channelId: true,
          alertEventId: true,
          status: true,
        },
      });

    if (!sourceDelivery) {
      throw new NotFoundException("告警通知投递不存在");
    }
    if (!["failed", "planned"].includes(sourceDelivery.status)) {
      throw new BadRequestException("只有失败或计划状态的通知投递可以重试");
    }

    const channel = await this.prisma.alertNotificationChannel.findFirst({
      where: { id: sourceDelivery.channelId, teamId },
      select: alertNotificationChannelDispatchSelect,
    });
    if (!channel) {
      throw new NotFoundException("告警通知通道不存在");
    }
    if (channel.status !== "active") {
      throw new BadRequestException("通知通道未启用，无法重试投递");
    }

    const event = await this.prisma.alertEvent.findFirst({
      where: { id: sourceDelivery.alertEventId, teamId },
      include: alertEventInclude,
    });
    if (!event) {
      throw new NotFoundException("告警事件不存在");
    }
    if (event.status === "suppressed") {
      throw new BadRequestException("静默告警事件不会重试通知投递");
    }
    if (
      !this.notificationDeliveryDispatchService.channelMatchesEvent(
        channel,
        event,
      )
    ) {
      throw new BadRequestException("通知通道当前过滤条件不匹配该告警事件");
    }

    const retriedDelivery =
      await this.notificationDeliveryDispatchService.deliverAlertNotification(
        teamId,
        channel,
        event,
      );
    await this.retryAuditService.writeRetryAudit(
      teamId,
      userId,
      event,
      retriedDelivery,
      sourceDelivery.id,
    );
    return retriedDelivery;
  }

  async retryFailedNotificationDeliveries(
    options: AlertNotificationAutoRetryOptions = {},
  ): Promise<AlertNotificationAutoRetrySummary> {
    const now = options.now || new Date();
    const batchSize = readPositiveInt(options.batchSize, 20, 1, 100);
    const minAgeSeconds = readPositiveInt(
      options.minAgeSeconds,
      300,
      60,
      24 * 60 * 60,
    );
    const maxAttempts = readPositiveInt(options.maxAttempts, 3, 2, 20);
    const attemptWindowMinutes = readPositiveInt(
      options.attemptWindowMinutes,
      60,
      5,
      24 * 60,
    );
    const staleBefore = new Date(now.getTime() - minAgeSeconds * 1000);
    const attemptWindowStart = new Date(
      now.getTime() - attemptWindowMinutes * 60 * 1000,
    );
    const candidates = await this.prisma.alertNotificationDelivery.findMany({
      where: {
        status: "failed",
        createdAt: { lte: staleBefore },
      },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: {
        id: true,
        teamId: true,
        channelId: true,
        alertEventId: true,
        createdAt: true,
      },
    });
    const summary: AlertNotificationAutoRetrySummary = {
      scanned: candidates.length,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedSuperseded: 0,
      skippedMaxAttempts: 0,
    };

    for (const candidate of candidates) {
      const newerAttempt =
        await this.prisma.alertNotificationDelivery.findFirst({
          where: {
            teamId: candidate.teamId,
            channelId: candidate.channelId,
            alertEventId: candidate.alertEventId,
            createdAt: { gt: candidate.createdAt },
          },
          select: { id: true },
        });
      if (newerAttempt) {
        summary.skippedSuperseded += 1;
        continue;
      }

      const recentAttempts =
        await this.prisma.alertNotificationDelivery.findMany({
          where: {
            teamId: candidate.teamId,
            channelId: candidate.channelId,
            alertEventId: candidate.alertEventId,
            createdAt: { gte: attemptWindowStart },
          },
          orderBy: { createdAt: "desc" },
          take: maxAttempts,
          select: { id: true },
        });
      if (recentAttempts.length >= maxAttempts) {
        summary.skippedMaxAttempts += 1;
        continue;
      }

      summary.attempted += 1;
      try {
        await this.retryNotificationDelivery(
          candidate.teamId,
          options.userId ?? null,
          candidate.id,
        );
        summary.completed += 1;
      } catch {
        summary.failed += 1;
      }
    }

    return summary;
  }
}
