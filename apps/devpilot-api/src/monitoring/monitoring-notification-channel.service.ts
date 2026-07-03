import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAlertNotificationChannelDto,
  UpdateAlertNotificationChannelDto,
} from "./dto/monitoring.dto";
import {
  normalizeAlertEventStatuses,
  normalizeAlertSeverityFilter,
} from "./monitoring-alert-filter.utils";
import { toJsonValue } from "./monitoring-json.utils";
import { alertNotificationChannelSelect } from "./monitoring-notification-channel.constants";
import { MonitoringNotificationChannelSettingsService } from "./monitoring-notification-channel-settings.service";
import { normalizeNotificationChannelType } from "./monitoring-notification-channel.utils";
import { MonitoringProjectEnvironmentScopeService } from "./monitoring-project-environment-scope.service";

type NotificationChannelScopeDto = Pick<
  CreateAlertNotificationChannelDto | UpdateAlertNotificationChannelDto,
  "projectId" | "environmentId"
>;

@Injectable()
export class MonitoringNotificationChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channelSettingsService: MonitoringNotificationChannelSettingsService,
    private readonly projectEnvironmentScopeService: MonitoringProjectEnvironmentScopeService,
  ) {}

  listChannels(teamId: string) {
    return this.prisma.alertNotificationChannel.findMany({
      where: { teamId, status: { not: "archived" } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: alertNotificationChannelSelect,
    });
  }

  resolveScope(teamId: string, dto: NotificationChannelScopeDto) {
    return this.projectEnvironmentScopeService.resolveLooseScope(
      teamId,
      dto.projectId,
      dto.environmentId,
    );
  }

  async getAccessScope(teamId: string, channelId: string) {
    const channel = await this.prisma.alertNotificationChannel.findFirst({
      where: { id: channelId, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!channel) {
      throw new NotFoundException("告警通知通道不存在");
    }

    return {
      projectId: channel.projectId,
      environmentId: channel.environmentId,
    };
  }

  async createChannel(
    teamId: string,
    userId: string,
    dto: CreateAlertNotificationChannelDto,
  ) {
    const scope = await this.resolveScope(teamId, dto);
    const channelType = normalizeNotificationChannelType(dto.type);
    const settings = this.channelSettingsService.buildSettings(
      channelType,
      dto,
    );

    return this.prisma.alertNotificationChannel.create({
      data: {
        teamId,
        createdById: userId,
        projectId: scope.projectId,
        environmentId: scope.environmentId,
        name: dto.name,
        type: channelType,
        status: "active",
        config: toJsonValue(settings.config),
        secretConfig: toJsonValue(settings.secretConfig),
        eventStatuses: toJsonValue(
          normalizeAlertEventStatuses(dto.eventStatuses),
        ),
        severityFilter: toJsonValue(
          normalizeAlertSeverityFilter(dto.severityFilter),
        ),
      },
      select: alertNotificationChannelSelect,
    });
  }

  async updateChannel(
    teamId: string,
    channelId: string,
    dto: UpdateAlertNotificationChannelDto,
  ) {
    const channel = await this.prisma.alertNotificationChannel.findFirst({
      where: { id: channelId, teamId },
      select: { id: true, type: true },
    });

    if (!channel) {
      throw new NotFoundException("告警通知通道不存在");
    }

    const data: Prisma.AlertNotificationChannelUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.eventStatuses !== undefined) {
      data.eventStatuses = toJsonValue(
        normalizeAlertEventStatuses(dto.eventStatuses),
      );
    }
    if (dto.severityFilter !== undefined) {
      data.severityFilter = toJsonValue(
        normalizeAlertSeverityFilter(dto.severityFilter),
      );
    }
    if (
      dto.webhookUrl !== undefined ||
      dto.emailRecipients !== undefined ||
      dto.emailSubjectPrefix !== undefined
    ) {
      const settings = this.channelSettingsService.buildSettings(
        normalizeNotificationChannelType(channel.type),
        dto,
      );
      data.config = toJsonValue(settings.config);
      data.secretConfig = toJsonValue(settings.secretConfig);
      data.lastError = null;
    }
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const scope = await this.resolveScope(teamId, dto);
      data.projectId = scope.projectId;
      data.environmentId = scope.environmentId;
    }

    return this.prisma.alertNotificationChannel.update({
      where: { id: channel.id },
      data,
      select: alertNotificationChannelSelect,
    });
  }

}
