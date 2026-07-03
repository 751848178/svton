import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAlertNotificationDeliveriesQueryDto } from "./dto/monitoring.dto";
import { alertNotificationDeliveryInclude } from "./monitoring-notification-delivery.constants";

@Injectable()
export class MonitoringNotificationDeliveryReadService {
  constructor(private readonly prisma: PrismaService) {}

  listDeliveries(
    teamId: string,
    query: ListAlertNotificationDeliveriesQueryDto,
  ) {
    const where: Prisma.AlertNotificationDeliveryWhereInput = { teamId };
    if (query.channelId) where.channelId = query.channelId;
    if (query.alertEventId) where.alertEventId = query.alertEventId;
    if (query.status) where.status = query.status;

    return this.prisma.alertNotificationDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: alertNotificationDeliveryInclude,
    });
  }

  async getAccessScope(teamId: string, deliveryId: string) {
    const delivery = await this.prisma.alertNotificationDelivery.findFirst({
      where: { id: deliveryId, teamId },
      include: {
        channel: { select: { projectId: true, environmentId: true } },
        alertEvent: { select: { projectId: true, environmentId: true } },
      },
    });

    if (!delivery) {
      throw new NotFoundException("告警通知投递不存在");
    }

    return {
      projectId: delivery.channel.projectId || delivery.alertEvent.projectId,
      environmentId:
        delivery.channel.environmentId || delivery.alertEvent.environmentId,
    };
  }
}
