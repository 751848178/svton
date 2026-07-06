import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAlertRuleDto,
  ListAlertRulesQueryDto,
  UpdateAlertRuleDto,
} from "./dto/monitoring.dto";
import { alertRuleInclude } from "./monitoring-alert-rule.constants";
import { MonitoringAlertRuleTargetService } from "./monitoring-alert-rule-target.service";
import { toJsonValue } from "./monitoring-json.utils";

@Injectable()
export class MonitoringAlertRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetService: MonitoringAlertRuleTargetService,
  ) {}

  listRules(teamId: string, query: ListAlertRulesQueryDto) {
    const where: Prisma.AlertRuleWhereInput = { teamId };

    if (query.category) where.category = query.category;
    if (query.metric) where.metric = query.metric;
    if (query.severity) where.severity = query.severity;
    if (query.lastStatus) where.lastStatus = query.lastStatus;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.alertRule.findMany({
      where,
      orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
      include: alertRuleInclude,
    });
  }

  async getRule(teamId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, teamId },
      include: alertRuleInclude,
    });

    if (!rule) {
      throw new NotFoundException("告警规则不存在");
    }

    return rule;
  }

  async getAccessScope(teamId: string, ruleId: string) {
    const rule = await this.getRule(teamId, ruleId);
    return {
      projectId: rule.projectId,
      environmentId: rule.environmentId,
    };
  }

  async resolveCreateAccessScope(teamId: string, dto: CreateAlertRuleDto) {
    const target = await this.targetService.resolveTargetContext(teamId, dto);
    return {
      projectId: target.projectId ?? null,
      environmentId: target.environmentId ?? null,
    };
  }

  async createRule(teamId: string, userId: string, dto: CreateAlertRuleDto) {
    const target = await this.targetService.resolveTargetContext(teamId, dto);
    const category = dto.category || target.category || "service";
    const metric = dto.metric || this.defaultMetric(category);

    return this.prisma.alertRule.create({
      data: {
        teamId,
        createdById: userId,
        ...target,
        category,
        metric,
        name: dto.name,
        severity: dto.severity || "warning",
        condition: dto.condition ? toJsonValue(dto.condition) : undefined,
        enabled: dto.enabled !== false,
        evaluationMode: dto.evaluationMode || "manual",
        intervalSeconds: dto.intervalSeconds || 300,
      },
      include: alertRuleInclude,
    });
  }

  async updateRule(teamId: string, ruleId: string, dto: UpdateAlertRuleDto) {
    const rule = await this.getRule(teamId, ruleId);
    const data: Prisma.AlertRuleUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.metric !== undefined) data.metric = dto.metric;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.condition !== undefined)
      data.condition = toJsonValue(dto.condition);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.evaluationMode !== undefined)
      data.evaluationMode = dto.evaluationMode;
    if (dto.intervalSeconds !== undefined)
      data.intervalSeconds = dto.intervalSeconds;

    return this.prisma.alertRule.update({
      where: { id: rule.id },
      data,
      include: alertRuleInclude,
    });
  }

  private defaultMetric(category: string) {
    const defaults: Record<string, string> = {
      service: "service_status",
      server: "server_status",
      site: "site_status",
      resource: "resource_status",
      backup: "backup_status",
      deployment: "deployment_status",
      log: "log_error_count",
    };
    return defaults[category] || "health_status";
  }
}
