import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateAlertNotificationChannelDto,
  ListAlertNotificationDeliveriesQueryDto,
  UpdateAlertNotificationChannelDto,
} from "./dto/monitoring.dto";
import { MonitoringAccessService } from "./monitoring-access.service";
import type { MonitoringAuthRequest } from "./monitoring-access.types";
import { MonitoringService } from "./monitoring.service";

@Controller("monitoring")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class MonitoringNotificationController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly monitoringAccess: MonitoringAccessService,
  ) {}

  @Get("notification-channels")
  async listNotificationChannels(@Request() req: MonitoringAuthRequest) {
    const channels = await this.monitoringService.listNotificationChannels(
      req.teamId,
    );
    return this.monitoringAccess.filterReadableMonitoringRecords(
      req,
      channels,
      "monitoring.notification_channel.read",
      "alert_notification_channel",
    );
  }

  @Post("notification-channels")
  async createNotificationChannel(
    @Request() req: MonitoringAuthRequest,
    @Body() dto: CreateAlertNotificationChannelDto,
  ) {
    const scope = await this.monitoringService.resolveNotificationChannelScope(
      req.teamId,
      dto,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.notification_channel.create",
      null,
      scope.projectId,
      scope.environmentId,
      "medium",
    );
    return this.monitoringService.createNotificationChannel(
      req.teamId,
      req.user.id,
      dto,
    );
  }

  @Put("notification-channels/:channelId")
  async updateNotificationChannel(
    @Request() req: MonitoringAuthRequest,
    @Param("channelId") channelId: string,
    @Body() dto: UpdateAlertNotificationChannelDto,
  ) {
    const currentScope =
      await this.monitoringService.getNotificationChannelAccessScope(
        req.teamId,
        channelId,
      );
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope =
        await this.monitoringService.resolveNotificationChannelScope(
          req.teamId,
          dto,
        );
      await this.monitoringAccess.assertCanWriteMonitoring(
        req,
        "monitoring.notification_channel.update",
        channelId,
        targetScope.projectId,
        targetScope.environmentId,
        "medium",
      );
    }
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.notification_channel.update",
      channelId,
      currentScope.projectId,
      currentScope.environmentId,
      "medium",
    );
    return this.monitoringService.updateNotificationChannel(
      req.teamId,
      channelId,
      dto,
    );
  }

  @Get("notification-deliveries")
  async listNotificationDeliveries(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListAlertNotificationDeliveriesQueryDto,
  ) {
    const deliveries = await this.monitoringService.listNotificationDeliveries(
      req.teamId,
      query,
    );
    return this.monitoringAccess.filterReadableMonitoringRecords(
      req,
      deliveries,
      "monitoring.notification_delivery.read",
      "alert_notification_delivery",
    );
  }

  @Post("notification-deliveries/:deliveryId/retry")
  async retryNotificationDelivery(
    @Request() req: MonitoringAuthRequest,
    @Param("deliveryId") deliveryId: string,
  ) {
    const scope =
      await this.monitoringService.getNotificationDeliveryAccessScope(
        req.teamId,
        deliveryId,
      );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.notification_delivery.retry",
      deliveryId,
      scope.projectId,
      scope.environmentId,
      "low",
    );
    return this.monitoringService.retryNotificationDelivery(
      req.teamId,
      req.user.id,
      deliveryId,
    );
  }
}
