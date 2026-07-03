import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAlertSilenceDto,
  ListAlertSilencesQueryDto,
  UpdateAlertSilenceDto,
} from "./dto/monitoring.dto";
import { normalizeAlertSeverityFilter } from "./monitoring-alert-filter.utils";
import { alertSilenceSelect } from "./monitoring-alert-silence.constants";
import type {
  AlertSilenceRecord,
  AlertSilenceRuleTarget,
} from "./monitoring-alert-silence.types";
import { MonitoringAlertSilenceMatcherService } from "./monitoring-alert-silence-matcher.service";
import { MonitoringAlertSilenceWindowService } from "./monitoring-alert-silence-window.service";
import { toJsonValue } from "./monitoring-json.utils";
import { MonitoringProjectEnvironmentScopeService } from "./monitoring-project-environment-scope.service";

type SilenceScopeDto = Pick<
  CreateAlertSilenceDto | UpdateAlertSilenceDto,
  "projectId" | "environmentId"
>;

@Injectable()
export class MonitoringAlertSilenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectEnvironmentScopeService: MonitoringProjectEnvironmentScopeService,
    private readonly silenceWindowService: MonitoringAlertSilenceWindowService,
    private readonly silenceMatcherService: MonitoringAlertSilenceMatcherService,
  ) {}

  listSilences(teamId: string, query: ListAlertSilencesQueryDto) {
    const where: Prisma.AlertSilenceWhereInput = { teamId };
    where.status = query.status || { not: "archived" };
    if (query.category) where.category = query.category;
    if (query.metric) where.metric = query.metric;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.alertSilence.findMany({
      where,
      orderBy: [{ status: "asc" }, { endsAt: "asc" }, { updatedAt: "desc" }],
      select: alertSilenceSelect,
    });
  }

  resolveScope(teamId: string, dto: SilenceScopeDto) {
    return this.projectEnvironmentScopeService.resolveLooseScope(
      teamId,
      dto.projectId,
      dto.environmentId,
    );
  }

  async getAccessScope(teamId: string, silenceId: string) {
    const silence = await this.prisma.alertSilence.findFirst({
      where: { id: silenceId, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!silence) throw new NotFoundException("告警静默规则不存在");

    return {
      projectId: silence.projectId,
      environmentId: silence.environmentId,
    };
  }

  async createSilence(
    teamId: string,
    userId: string,
    dto: CreateAlertSilenceDto,
  ) {
    const scope = await this.resolveScope(teamId, dto);
    const window = this.silenceWindowService.resolveWindow(
      dto.startsAt,
      dto.endsAt,
    );

    return this.prisma.alertSilence.create({
      data: {
        teamId,
        createdById: userId,
        projectId: scope.projectId,
        environmentId: scope.environmentId,
        name: dto.name,
        category: dto.category,
        metric: this.readString(dto.metric),
        severityFilter: toJsonValue(
          normalizeAlertSeverityFilter(dto.severityFilter),
        ),
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        reason: this.readString(dto.reason),
      },
      select: alertSilenceSelect,
    });
  }

  async updateSilence(
    teamId: string,
    silenceId: string,
    dto: UpdateAlertSilenceDto,
  ) {
    const current = await this.prisma.alertSilence.findFirst({
      where: { id: silenceId, teamId },
      select: { id: true, startsAt: true, endsAt: true },
    });

    if (!current) throw new NotFoundException("告警静默规则不存在");

    const data: Prisma.AlertSilenceUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.metric !== undefined) data.metric = this.readString(dto.metric) || null;
    if (dto.reason !== undefined) data.reason = this.readString(dto.reason) || null;
    if (dto.severityFilter !== undefined) {
      data.severityFilter = toJsonValue(
        normalizeAlertSeverityFilter(dto.severityFilter),
      );
    }
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const scope = await this.resolveScope(teamId, dto);
      data.projectId = scope.projectId;
      data.environmentId = scope.environmentId;
    }
    if (dto.startsAt !== undefined || dto.endsAt !== undefined) {
      const window = this.silenceWindowService.resolveWindow(
        dto.startsAt,
        dto.endsAt,
        current.startsAt,
        current.endsAt,
      );
      data.startsAt = window.startsAt;
      data.endsAt = window.endsAt;
    }

    return this.prisma.alertSilence.update({
      where: { id: current.id },
      data,
      select: alertSilenceSelect,
    });
  }

  async findMatchingSilence(
    teamId: string,
    rule: AlertSilenceRuleTarget,
    eventStatus: string,
  ): Promise<AlertSilenceRecord | null> {
    return this.silenceMatcherService.findMatchingSilence(
      teamId,
      rule,
      eventStatus,
    );
  }

  buildEventMetadata(
    metadata: Record<string, unknown> | undefined,
    silence: AlertSilenceRecord | null,
  ) {
    return this.silenceMatcherService.buildEventMetadata(metadata, silence);
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
