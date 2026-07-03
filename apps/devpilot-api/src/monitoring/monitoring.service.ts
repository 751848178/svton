import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAlertNotificationChannelDto,
  CreateAlertRuleDto,
  CreateAlertSilenceDto,
  EvaluateAlertRuleDto,
  ListAlertNotificationDeliveriesQueryDto,
  ListAlertEventsQueryDto,
  ListAlertRulesQueryDto,
  ListAlertSilencesQueryDto,
  ListResourceMetricDashboardQueryDto,
  ListServiceSloDashboardQueryDto,
  UpdateAlertNotificationChannelDto,
  UpdateAlertRuleDto,
  UpdateAlertSilenceDto,
} from './dto/monitoring.dto';
import { alertEventInclude } from './monitoring-alert-event.constants';
import { MonitoringAlertEscalationService } from './monitoring-alert-escalation.service';
import type {
  AlertEscalationOptions,
  AlertEscalationSummary,
} from './monitoring-alert-escalation.types';
import type { AlertEventRecord } from './monitoring-alert-event.types';
import { riskFromAlertSeverity } from './monitoring-alert-risk.utils';
import { MonitoringAlertSilenceService } from './monitoring-alert-silence.service';
import { MonitoringResourceMetricDashboardService } from './monitoring-resource-metric-dashboard.service';
import type {
  ResourceMetricDashboardRow,
  ResourceMetricDashboardSnapshot,
} from './monitoring-resource-metric-dashboard.types';
import { toJsonValue } from './monitoring-json.utils';
import { MonitoringNotificationChannelService } from './monitoring-notification-channel.service';
import { MonitoringNotificationDeliveryDispatchService } from './monitoring-notification-delivery-dispatch.service';
import { MonitoringNotificationDeliveryReadService } from './monitoring-notification-delivery-read.service';
import { MonitoringNotificationRetryService } from './monitoring-notification-retry.service';
import type {
  AlertNotificationAutoRetryOptions,
  AlertNotificationAutoRetrySummary,
} from './monitoring-notification-retry.types';
import { readPositiveInt } from './monitoring-number.utils';
import { serviceSloDerivedMetrics } from './monitoring-service-slo.constants';
import { MonitoringServiceSloDashboardService } from './monitoring-service-slo-dashboard.service';
import type {
  ServiceSloAlertEvent,
  ServiceSloDashboardRow,
  ServiceSloDeploymentRun,
  ServiceSloOperationRun,
  ServiceSloServiceRecord,
} from './monitoring-service-slo-dashboard.types';

const alertRuleInclude = Prisma.validator<Prisma.AlertRuleInclude>()({
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: { select: { id: true, name: true, kind: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true, tls: true } },
  managedResource: {
    select: { id: true, name: true, sourceType: true, provider: true, kind: true, status: true, endpoint: true },
  },
  backupPlan: { select: { id: true, name: true, status: true, lastStatus: true, lastRunAt: true } },
  events: {
    orderBy: { occurredAt: 'desc' },
    take: 3,
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      status: true,
      severity: true,
      summary: true,
      occurredAt: true,
      resolvedAt: true,
    },
  },
});

const dedupeEligibleAlertEventStatuses = ['firing', 'error', 'suppressed'];

type AlertRuleRecord = Prisma.AlertRuleGetPayload<{ include: typeof alertRuleInclude }>;

type ServiceSloRuleTemplate = {
  id: string;
  name: string;
  description: string;
  targetType: 'service_slo' | 'service_error_budget' | 'service_error_budget_exhaustion';
  category: 'service';
  metric: 'service_slo_breach' | 'service_error_budget' | 'service_error_budget_exhaustion';
  severity: 'warning' | 'critical';
  evaluationMode: 'schedule';
  intervalSeconds: number;
  condition: Record<string, unknown>;
};

const serviceSloRuleTemplates: ServiceSloRuleTemplate[] = [
  {
    id: 'standard_api_availability',
    name: '标准 API 可用性',
    description: '99% SLO，最近 24 小时单窗口，适合大多数业务 API 的第一条可用性告警。',
    targetType: 'service_slo',
    category: 'service',
    metric: 'service_slo_breach',
    severity: 'warning',
    evaluationMode: 'schedule',
    intervalSeconds: 300,
    condition: {
      strategy: 'single_window',
      windowMinutes: 1440,
      targetPercent: 99,
      burnRateThreshold: 1,
      dedupeWindowMinutes: 30,
    },
  },
  {
    id: 'high_reliability_burn_rate',
    name: '高可靠短长窗口',
    description: '99.9% SLO，短窗口和长窗口同时触发才告警，适合核心链路减少误报。',
    targetType: 'service_slo',
    category: 'service',
    metric: 'service_slo_breach',
    severity: 'critical',
    evaluationMode: 'schedule',
    intervalSeconds: 300,
    condition: {
      strategy: 'multi_window_burn_rate',
      matchPolicy: 'all',
      targetPercent: 99.9,
      dedupeWindowMinutes: 30,
      windows: [
        {
          label: '短窗口',
          windowMinutes: 60,
          targetPercent: 99.9,
          burnRateThreshold: 14,
        },
        {
          label: '长窗口',
          windowMinutes: 360,
          targetPercent: 99.9,
          burnRateThreshold: 6,
        },
      ],
    },
  },
  {
    id: 'error_budget_guardrail',
    name: '错误预算保护线',
    description: '最近 7 天错误预算低于 25% 时告警，适合在真正违约前提醒收敛变更。',
    targetType: 'service_error_budget',
    category: 'service',
    metric: 'service_error_budget',
    severity: 'warning',
    evaluationMode: 'schedule',
    intervalSeconds: 300,
    condition: {
      windowMinutes: 10080,
      targetPercent: 99,
      remainingThresholdPercent: 25,
      dedupeWindowMinutes: 60,
    },
  },
  {
    id: 'error_budget_exhaustion_forecast',
    name: '错误预算耗尽预测',
    description: '按最近 24 小时 burn rate 预测 24 小时内是否会耗尽错误预算，适合提前收敛发布风险。',
    targetType: 'service_error_budget_exhaustion',
    category: 'service',
    metric: 'service_error_budget_exhaustion',
    severity: 'critical',
    evaluationMode: 'schedule',
    intervalSeconds: 300,
    condition: {
      windowMinutes: 1440,
      targetPercent: 99,
      exhaustionWithinMinutes: 1440,
      dedupeWindowMinutes: 60,
    },
  },
];

type TargetContext = {
  category?: string;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  backupPlanId?: string | null;
};

type EvaluationResult = {
  status: 'ok' | 'firing' | 'insufficient_data' | 'error';
  eventStatus: 'resolved' | 'firing' | 'insufficient_data' | 'error';
  summary: string;
  value: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type CloudSyncProviderDiagnostic = {
  provider: string;
  syncMode?: string;
  fallbackReason?: string;
  live?: boolean;
  errors: string[];
};

type CloudSyncFailureSample = {
  runId: string;
  provider: string;
  status: string;
  reason: string;
  startedAt: Date;
  fallbackReason?: string;
  errors?: string[];
};

type ResourceMetricField = {
  key: string;
  label: string;
  unit: 'percent' | 'bytes' | 'count';
};

type ServiceSloMatchPolicy = 'any' | 'all';

type ServiceSloWindowSpec = {
  label: string;
  windowMinutes: number;
  targetPercent: number;
  burnRateThreshold: number;
};

type ServiceSloWindowEvaluation = ServiceSloWindowSpec & {
  status: 'ok' | 'firing' | 'no_data';
  statusReason: string;
  from: Date;
  to: Date;
  sloPercent: number | null;
  errorBudgetRemainingPercent: number | null;
  burnRate: number | null;
  deploymentCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  breachReasons: string[];
};

const resourceMetricFields: Record<string, ResourceMetricField> = {
  cpuPercent: { key: 'cpuPercent', label: 'CPU', unit: 'percent' },
  memoryPercent: { key: 'memoryPercent', label: '内存', unit: 'percent' },
  memoryUsageBytes: { key: 'memoryUsageBytes', label: '内存用量', unit: 'bytes' },
  networkInputBytes: { key: 'networkInputBytes', label: '网络入流量', unit: 'bytes' },
  networkOutputBytes: { key: 'networkOutputBytes', label: '网络出流量', unit: 'bytes' },
  blockInputBytes: { key: 'blockInputBytes', label: '块 IO 入流量', unit: 'bytes' },
  blockOutputBytes: { key: 'blockOutputBytes', label: '块 IO 出流量', unit: 'bytes' },
  pids: { key: 'pids', label: 'PIDs', unit: 'count' },
};

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventService: AuditEventService,
    private readonly configService: ConfigService,
    private readonly resourceMetricDashboardService: MonitoringResourceMetricDashboardService,
    private readonly serviceSloDashboardService: MonitoringServiceSloDashboardService,
    private readonly alertSilenceService: MonitoringAlertSilenceService,
    private readonly notificationDeliveryReadService: MonitoringNotificationDeliveryReadService,
    private readonly notificationChannelService: MonitoringNotificationChannelService,
    private readonly notificationDeliveryDispatchService: MonitoringNotificationDeliveryDispatchService,
    private readonly notificationRetryService: MonitoringNotificationRetryService,
    private readonly alertEscalationService: MonitoringAlertEscalationService,
  ) {}

  listServiceSloRuleTemplates() {
    return serviceSloRuleTemplates.map((template) => (
      JSON.parse(JSON.stringify(template)) as ServiceSloRuleTemplate
    ));
  }

  async listRules(teamId: string, query: ListAlertRulesQueryDto) {
    const where: Prisma.AlertRuleWhereInput = { teamId };

    if (query.category) where.category = query.category;
    if (query.metric) where.metric = query.metric;
    if (query.severity) where.severity = query.severity;
    if (query.lastStatus) where.lastStatus = query.lastStatus;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.alertRule.findMany({
      where,
      orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }],
      include: alertRuleInclude,
    });
  }

  async listEvents(teamId: string, query: ListAlertEventsQueryDto) {
    const where: Prisma.AlertEventWhereInput = { teamId };

    if (query.ruleId) where.ruleId = query.ruleId;
    if (query.category) where.category = query.category;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.alertEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100,
      include: alertEventInclude,
    });
  }

  async listResourceMetricDashboardRows(teamId: string, query: ListResourceMetricDashboardQueryDto) {
    return this.resourceMetricDashboardService.listRows(teamId, query);
  }

  buildResourceMetricDashboardRows(
    snapshots: ResourceMetricDashboardSnapshot[],
    staleAfterMinutes = 180,
  ): ResourceMetricDashboardRow[] {
    return this.resourceMetricDashboardService.buildRows(snapshots, staleAfterMinutes);
  }

  summarizeResourceMetricDashboard(
    rows: ResourceMetricDashboardRow[],
    windowMinutes = 360,
    staleAfterMinutes = 180,
    generatedAt = new Date(),
  ) {
    return this.resourceMetricDashboardService.summarize(
      rows,
      windowMinutes,
      staleAfterMinutes,
      generatedAt,
    );
  }

  async listServiceSloDashboardRows(teamId: string, query: ListServiceSloDashboardQueryDto) {
    return this.serviceSloDashboardService.listRows(teamId, query);
  }

  buildServiceSloDashboardRows(
    services: ServiceSloServiceRecord[],
    deploymentRuns: ServiceSloDeploymentRun[],
    operationRuns: ServiceSloOperationRun[],
    alertEvents: ServiceSloAlertEvent[],
    targetPercent = 99,
  ): ServiceSloDashboardRow[] {
    return this.serviceSloDashboardService.buildRows(
      services,
      deploymentRuns,
      operationRuns,
      alertEvents,
      targetPercent,
    );
  }

  summarizeServiceSloDashboard(
    rows: ServiceSloDashboardRow[],
    windowMinutes = 1440,
    targetPercent = 99,
    generatedAt = new Date(),
  ) {
    return this.serviceSloDashboardService.summarize(
      rows,
      windowMinutes,
      targetPercent,
      generatedAt,
    );
  }

  async listSilences(teamId: string, query: ListAlertSilencesQueryDto) {
    return this.alertSilenceService.listSilences(teamId, query);
  }

  async resolveSilenceScope(
    teamId: string,
    dto: Pick<CreateAlertSilenceDto | UpdateAlertSilenceDto, 'projectId' | 'environmentId'>,
  ) {
    return this.alertSilenceService.resolveScope(teamId, dto);
  }

  async getSilenceAccessScope(teamId: string, silenceId: string) {
    return this.alertSilenceService.getAccessScope(teamId, silenceId);
  }

  async createSilence(teamId: string, userId: string, dto: CreateAlertSilenceDto) {
    return this.alertSilenceService.createSilence(teamId, userId, dto);
  }

  async updateSilence(teamId: string, silenceId: string, dto: UpdateAlertSilenceDto) {
    return this.alertSilenceService.updateSilence(teamId, silenceId, dto);
  }

  async listNotificationChannels(teamId: string) {
    return this.notificationChannelService.listChannels(teamId);
  }

  async listNotificationDeliveries(teamId: string, query: ListAlertNotificationDeliveriesQueryDto) {
    return this.notificationDeliveryReadService.listDeliveries(teamId, query);
  }

  async getNotificationDeliveryAccessScope(teamId: string, deliveryId: string) {
    return this.notificationDeliveryReadService.getAccessScope(teamId, deliveryId);
  }

  async retryNotificationDelivery(teamId: string, userId: string | null, deliveryId: string) {
    return this.notificationRetryService.retryNotificationDelivery(teamId, userId, deliveryId);
  }

  async retryFailedNotificationDeliveries(
    options: AlertNotificationAutoRetryOptions = {},
  ): Promise<AlertNotificationAutoRetrySummary> {
    return this.notificationRetryService.retryFailedNotificationDeliveries(options);
  }

  async escalateStaleAlertEvents(options: AlertEscalationOptions = {}): Promise<AlertEscalationSummary> {
    return this.alertEscalationService.escalateStaleAlertEvents(options);
  }

  async resolveNotificationChannelScope(
    teamId: string,
    dto: Pick<CreateAlertNotificationChannelDto | UpdateAlertNotificationChannelDto, 'projectId' | 'environmentId'>,
  ) {
    return this.notificationChannelService.resolveScope(teamId, dto);
  }

  async getNotificationChannelAccessScope(teamId: string, channelId: string) {
    return this.notificationChannelService.getAccessScope(teamId, channelId);
  }

  async createNotificationChannel(teamId: string, userId: string, dto: CreateAlertNotificationChannelDto) {
    return this.notificationChannelService.createChannel(teamId, userId, dto);
  }

  async updateNotificationChannel(teamId: string, channelId: string, dto: UpdateAlertNotificationChannelDto) {
    return this.notificationChannelService.updateChannel(teamId, channelId, dto);
  }

  async resolveRuleCreateAccessScope(teamId: string, dto: CreateAlertRuleDto) {
    const target = await this.resolveTargetContext(teamId, dto);
    return {
      projectId: target.projectId ?? null,
      environmentId: target.environmentId ?? null,
    };
  }

  async getRuleAccessScope(teamId: string, ruleId: string) {
    const rule = await this.getRule(teamId, ruleId);
    return {
      projectId: rule.projectId,
      environmentId: rule.environmentId,
    };
  }

  async getEventAccessScope(teamId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id: eventId, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!event) {
      throw new NotFoundException('告警事件不存在');
    }

    return {
      projectId: event.projectId,
      environmentId: event.environmentId,
    };
  }

  async createRule(teamId: string, userId: string, dto: CreateAlertRuleDto) {
    const target = await this.resolveTargetContext(teamId, dto);
    const category = dto.category || target.category || 'service';
    const metric = dto.metric || this.defaultMetric(category);

    return this.prisma.alertRule.create({
      data: {
        teamId,
        createdById: userId,
        ...target,
        category,
        metric,
        name: dto.name,
        severity: dto.severity || 'warning',
        condition: dto.condition ? toJsonValue(dto.condition) : undefined,
        enabled: dto.enabled !== false,
        evaluationMode: dto.evaluationMode || 'manual',
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
    if (dto.condition !== undefined) data.condition = toJsonValue(dto.condition);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.evaluationMode !== undefined) data.evaluationMode = dto.evaluationMode;
    if (dto.intervalSeconds !== undefined) data.intervalSeconds = dto.intervalSeconds;

    return this.prisma.alertRule.update({
      where: { id: rule.id },
      data,
      include: alertRuleInclude,
    });
  }

  async evaluateRule(teamId: string, userId: string | null, ruleId: string, dto: EvaluateAlertRuleDto) {
    const rule = await this.getRule(teamId, ruleId);

    if (!rule.enabled) {
      const disabled = await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastEvaluatedAt: new Date(),
          lastStatus: 'insufficient_data',
          lastMessage: '规则已停用，未执行评估。',
        },
        include: alertRuleInclude,
      });
      return { rule: disabled, event: null };
    }

    const evaluation = await this.evaluate(rule, dto.observedValue || {});
    const matchedSilence = await this.alertSilenceService.findMatchingSilence(
      teamId,
      rule,
      evaluation.eventStatus,
    );
    const eventStatus = matchedSilence ? 'suppressed' : evaluation.eventStatus;
    const eventSummary = matchedSilence
      ? `${evaluation.summary}（已静默：${matchedSilence.name}）`
      : evaluation.summary;
    const eventMetadata = this.alertSilenceService.buildEventMetadata(
      evaluation.metadata,
      matchedSilence,
    );
    const duplicateEvent = await this.findDuplicateAlertEvent(teamId, rule, eventStatus);
    if (duplicateEvent) {
      const updatedRule = await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastEvaluatedAt: new Date(),
          lastStatus: evaluation.status,
          lastMessage: `${evaluation.summary}（已去重，最近事件 ${duplicateEvent.id}）`,
        },
        include: alertRuleInclude,
      });
      await this.writeAlertDedupedAudit(teamId, userId, updatedRule, duplicateEvent, eventStatus, evaluation.summary);
      return { rule: updatedRule, event: duplicateEvent };
    }

    const event = await this.prisma.alertEvent.create({
      data: {
        teamId,
        ruleId: rule.id,
        actorId: userId,
        projectId: rule.projectId,
        environmentId: rule.environmentId,
        applicationId: rule.applicationId,
        applicationServiceId: rule.applicationServiceId,
        serverId: rule.serverId,
        siteId: rule.siteId,
        managedResourceId: rule.managedResourceId,
        backupPlanId: rule.backupPlanId,
        category: rule.category,
        metric: rule.metric,
        severity: rule.severity,
        status: eventStatus,
        value: toJsonValue(evaluation.value),
        condition: rule.condition ? toJsonValue(rule.condition) : undefined,
        summary: eventSummary,
        metadata: eventMetadata ? toJsonValue(eventMetadata) : undefined,
        resolvedAt: eventStatus === 'resolved' ? new Date() : undefined,
      },
      include: alertEventInclude,
    });

    const updatedRule = await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastEvaluatedAt: new Date(),
        lastStatus: evaluation.status,
        lastMessage: evaluation.summary,
      },
      include: alertRuleInclude,
    });

    await this.writeAlertAudit(teamId, userId, updatedRule, event);
    await this.notificationDeliveryDispatchService.dispatchAlertNotifications(teamId, event);
    return { rule: updatedRule, event };
  }

  async acknowledgeEvent(teamId: string, userId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id: eventId, teamId },
      include: alertEventInclude,
    });

    if (!event) {
      throw new NotFoundException('告警事件不存在');
    }

    const acknowledged = await this.prisma.alertEvent.update({
      where: { id: event.id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
      include: alertEventInclude,
    });

    await this.writeAlertAudit(teamId, userId, acknowledged.rule || null, acknowledged, 'alert.acknowledge');
    return acknowledged;
  }

  private async findDuplicateAlertEvent(
    teamId: string,
    rule: AlertRuleRecord,
    eventStatus: string,
  ): Promise<AlertEventRecord | null> {
    if (!dedupeEligibleAlertEventStatuses.includes(eventStatus)) {
      return null;
    }

    const condition = this.asRecord(rule.condition);
    if (this.readBoolean(condition.dedupeEnabled) === false) {
      return null;
    }

    const dedupeWindowMinutes = readPositiveInt(condition.dedupeWindowMinutes, 30, 1, 10080);
    const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000);
    return this.prisma.alertEvent.findFirst({
      where: {
        teamId,
        ruleId: rule.id,
        category: rule.category,
        metric: rule.metric,
        status: eventStatus,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'desc' },
      include: alertEventInclude,
    });
  }

  private async getRule(teamId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, teamId },
      include: alertRuleInclude,
    });

    if (!rule) {
      throw new NotFoundException('告警规则不存在');
    }

    return rule;
  }

  private async resolveTargetContext(
    teamId: string,
    dto: CreateAlertRuleDto,
  ): Promise<TargetContext> {
    if (dto.applicationServiceId) {
      const service = await this.prisma.applicationService.findFirst({
        where: { id: dto.applicationServiceId, teamId },
        select: {
          id: true,
          projectId: true,
          applicationId: true,
          environmentId: true,
          serverId: true,
          siteId: true,
          managedResourceId: true,
        },
      });
      if (!service) throw new NotFoundException('应用服务不存在');
      return {
        category: 'service',
        projectId: service.projectId,
        applicationId: service.applicationId,
        environmentId: service.environmentId,
        applicationServiceId: service.id,
        serverId: service.serverId,
        siteId: service.siteId,
        managedResourceId: service.managedResourceId,
      };
    }

    if (dto.backupPlanId) {
      const backupPlan = await this.prisma.backupPlan.findFirst({
        where: { id: dto.backupPlanId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true, resourceId: true },
      });
      if (!backupPlan) throw new NotFoundException('备份计划不存在');
      return {
        category: 'backup',
        projectId: backupPlan.projectId,
        environmentId: backupPlan.environmentId,
        serverId: backupPlan.serverId,
        managedResourceId: backupPlan.resourceId,
        backupPlanId: backupPlan.id,
      };
    }

    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true },
      });
      if (!site) throw new NotFoundException('站点不存在');
      return {
        category: 'site',
        projectId: site.projectId,
        environmentId: site.environmentId,
        serverId: site.serverId,
        siteId: site.id,
      };
    }

    if (dto.managedResourceId) {
      const resource = await this.prisma.managedResource.findFirst({
        where: { id: dto.managedResourceId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true },
      });
      if (!resource) throw new NotFoundException('托管资源不存在');
      return {
        category: 'resource',
        projectId: resource.projectId,
        environmentId: resource.environmentId,
        serverId: resource.serverId,
        managedResourceId: resource.id,
      };
    }

    if (dto.serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: dto.serverId, teamId },
        select: { id: true },
      });
      if (!server) throw new NotFoundException('服务器不存在');
      return {
        category: 'server',
        projectId: dto.projectId,
        environmentId: dto.environmentId,
        serverId: server.id,
      };
    }

    await this.validateLooseScope(teamId, dto);
    return {
      category: dto.category,
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      applicationId: dto.applicationId,
    };
  }

  private async validateLooseScope(teamId: string, dto: CreateAlertRuleDto) {
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('项目不存在');
    }

    if (dto.environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: dto.environmentId, teamId },
        select: { id: true, projectId: true },
      });
      if (!environment) throw new NotFoundException('项目环境不存在');
      if (dto.projectId && environment.projectId !== dto.projectId) {
        throw new BadRequestException('项目环境不属于指定项目');
      }
    }

    if (dto.applicationId) {
      const application = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, teamId },
        select: { id: true, projectId: true },
      });
      if (!application) throw new NotFoundException('应用不存在');
      if (dto.projectId && application.projectId !== dto.projectId) {
        throw new BadRequestException('应用不属于指定项目');
      }
    }
  }

  private async evaluate(
    rule: AlertRuleRecord,
    observedValue: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    if (Object.keys(observedValue).length > 0) {
      return this.evaluateObservedValue(rule, observedValue);
    }

    switch (rule.category) {
      case 'server':
        return this.evaluateStatusTarget(rule, rule.server, ['online'], '服务器状态');
      case 'site':
        if (rule.metric === 'certificate_expiry') {
          return this.evaluateSiteCertificateExpiry(rule);
        }
        if (rule.metric === 'certificate_asset_change') {
          return this.evaluateSiteCertificateAssetChange(rule);
        }
        if (rule.metric === 'tls_renewal_failure') {
          return this.evaluateSiteTlsRenewalFailure(rule);
        }
        if (rule.metric === 'site_smoke_check_failure') {
          return this.evaluateSiteSmokeCheckFailure(rule);
        }
        return this.evaluateStatusTarget(rule, rule.site, ['active'], '站点状态');
      case 'resource':
        if (rule.metric === 'cloud_provider_sync_failure') {
          return this.evaluateCloudProviderSyncFailure(rule);
        }
        if (rule.metric === 'resource_metric_threshold') {
          return this.evaluateResourceMetricThreshold(rule);
        }
        return this.evaluateStatusTarget(rule, rule.managedResource, ['active', 'running'], '资源状态');
      case 'backup':
        return this.evaluateBackup(rule);
      case 'deployment':
        if (rule.metric === 'deployment_smoke_check_failure') {
          return this.evaluateDeploymentSmokeCheckFailure(rule);
        }
        return this.evaluateDeployment(rule);
      case 'log':
        return this.evaluateLogCount(rule);
      case 'service':
        if (rule.metric === 'service_slo_breach') {
          return this.evaluateServiceSloBreach(rule);
        }
        if (rule.metric === 'service_error_budget') {
          return this.evaluateServiceErrorBudget(rule);
        }
        if (rule.metric === 'service_error_budget_exhaustion') {
          return this.evaluateServiceErrorBudgetExhaustion(rule);
        }
        return this.evaluateStatusTarget(rule, rule.applicationService, ['active'], '服务状态');
      default:
        return this.evaluateStatusTarget(rule, rule.applicationService, ['active'], '服务状态');
    }
  }

  private evaluateObservedValue(
    rule: AlertRuleRecord,
    observedValue: Record<string, unknown>,
  ): EvaluationResult {
    const condition = this.asRecord(rule.condition);
    const expectedStatuses = this.readStringArray(condition.expectedStatuses);
    const status = this.readString(observedValue.status);

    if (!status) {
      return this.insufficient(rule, '手动观测值缺少 status 字段', observedValue);
    }

    const expected = expectedStatuses.length > 0 ? expectedStatuses : ['ok', 'active', 'running', 'online', 'completed'];
    if (expected.includes(status)) {
      return this.ok(rule, `观测值 ${status} 符合预期`, observedValue);
    }

    return this.firing(rule, `观测值 ${status} 不符合预期`, observedValue);
  }

  private evaluateStatusTarget(
    rule: AlertRuleRecord,
    target: { id: string; name: string; status: string } | null,
    defaultExpectedStatuses: string[],
    label: string,
  ): EvaluationResult {
    if (!target) {
      return this.insufficient(rule, `规则未绑定${label}目标`, {});
    }

    const condition = this.asRecord(rule.condition);
    const expectedStatuses = this.readStringArray(condition.expectedStatuses);
    const expected = expectedStatuses.length > 0 ? expectedStatuses : defaultExpectedStatuses;
    const value = {
      targetId: target.id,
      targetName: target.name,
      status: target.status,
      expectedStatuses: expected,
    };

    if (expected.includes(target.status)) {
      return this.ok(rule, `${label}正常: ${target.name} 为 ${target.status}`, value);
    }

    return this.firing(rule, `${label}异常: ${target.name} 为 ${target.status}`, value);
  }

  private evaluateSiteCertificateExpiry(rule: AlertRuleRecord): EvaluationResult {
    const site = rule.site;
    if (!site) {
      return this.insufficient(rule, '规则未绑定站点目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const thresholdDays = readPositiveInt(condition.thresholdDays, 14, 1, 365);
    const tls = this.asRecord(site.tls);
    const tlsType = this.readString(tls.type) || 'unknown';
    const tlsEnabled = tls.enabled === true || (tlsType !== 'none' && tlsType !== 'unknown');
    const expiry = this.readCertificateExpiry(tls);
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      tlsEnabled,
      tlsType,
      thresholdDays,
      expiresAt: expiry?.expiresAt.toISOString() || null,
      expirySource: expiry?.source || null,
      daysRemaining: expiry?.daysRemaining ?? null,
      issuer: this.readCertificateMetadata(tls, 'issuer'),
      serialNumber: this.readCertificateMetadata(tls, 'serialNumber'),
      autoRenew: this.readBoolean(tls.autoRenew) ?? this.readBoolean(this.asRecord(tls.certificate).autoRenew),
    };

    if (!tlsEnabled) {
      return this.insufficient(rule, `站点 ${site.name} 未启用 TLS，无法评估证书过期`, value);
    }

    if (!expiry) {
      return this.insufficient(rule, `站点 ${site.name} 缺少证书过期时间`, value);
    }

    if (expiry.daysRemaining < 0) {
      return this.firing(rule, `站点 ${site.name} 证书已过期 ${Math.abs(expiry.daysRemaining)} 天`, value);
    }

    if (expiry.daysRemaining <= thresholdDays) {
      return this.firing(
        rule,
        `站点 ${site.name} 证书将在 ${expiry.daysRemaining} 天后过期，阈值 ${thresholdDays} 天`,
        value,
      );
    }

    return this.ok(rule, `站点 ${site.name} 证书还有 ${expiry.daysRemaining} 天过期`, value);
  }

  private evaluateSiteCertificateAssetChange(rule: AlertRuleRecord): EvaluationResult {
    const site = rule.site;
    if (!site) {
      return this.insufficient(rule, '规则未绑定站点目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowHours = readPositiveInt(condition.windowHours, 24, 1, 24 * 30);
    const includeFirstObservation = this.readBoolean(condition.includeFirstObservation) === true;
    const tls = this.asRecord(site.tls);
    const assets = this.readCertificateAssets(tls.assets);
    const currentAssetId = this.readString(tls.currentCertificateAssetId);
    const currentAsset = assets.find((asset) => asset.id === currentAssetId) || assets.find((asset) => asset.active);
    const previousAsset = assets.find((asset) => asset.id !== currentAsset?.id);
    const changedAt = this.parseOptionalDate(tls.lastCertificateAssetChangedAt);
    const hoursSinceChange = changedAt
      ? Math.max(0, Math.floor((Date.now() - changedAt.getTime()) / (60 * 60 * 1000)))
      : null;
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      windowHours,
      includeFirstObservation,
      assetCount: assets.length,
      currentCertificateAssetId: currentAsset?.id || currentAssetId || null,
      previousCertificateAssetId: previousAsset?.id || null,
      changedAt: changedAt?.toISOString() || null,
      hoursSinceChange,
      currentFingerprint: currentAsset?.fingerprintSha256 || null,
      previousFingerprint: previousAsset?.fingerprintSha256 || null,
      currentIssuer: currentAsset?.issuer || null,
      previousIssuer: previousAsset?.issuer || null,
      currentExpiresAt: currentAsset?.expiresAt || null,
      previousExpiresAt: previousAsset?.expiresAt || null,
    };

    if (!assets.length || !currentAsset) {
      return this.insufficient(rule, `站点 ${site.name} 没有证书资产快照`, value);
    }

    if (assets.length < 2 && !includeFirstObservation) {
      return this.ok(rule, `站点 ${site.name} 只有首次证书资产快照，未发现证书变化`, value);
    }

    if (!changedAt) {
      return this.insufficient(rule, `站点 ${site.name} 缺少证书资产变化时间`, value);
    }

    if (hoursSinceChange !== null && hoursSinceChange <= windowHours) {
      return this.firing(
        rule,
        `站点 ${site.name} 证书资产在最近 ${hoursSinceChange} 小时内发生变化`,
        value,
      );
    }

    return this.ok(rule, `站点 ${site.name} 最近 ${windowHours} 小时内未发现证书资产变化`, value);
  }

  private evaluateSiteTlsRenewalFailure(rule: AlertRuleRecord): EvaluationResult {
    const site = rule.site;
    if (!site) {
      return this.insufficient(rule, '规则未绑定站点目标', {});
    }

    const tls = this.asRecord(site.tls);
    const renewal = this.asRecord(tls.renewal);
    const followUpProbe = this.asRecord(renewal.followUpProbe);
    const renewalStatus = this.readString(renewal.status) || this.readString(tls.lastRenewalStatus);
    const followUpProbeStatus =
      this.readString(followUpProbe.status) || this.readString(tls.lastRenewalFollowUpProbeStatus);
    const renewalRunId = this.readString(renewal.runId) || this.readString(tls.lastRenewalRunId);
    const followUpRunId =
      this.readString(followUpProbe.siteSyncRunId) || this.readString(tls.lastRenewalFollowUpProbeRunId);
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      tlsType: this.readString(tls.type) || 'unknown',
      renewalStatus: renewalStatus || null,
      renewalRunId: renewalRunId || null,
      renewalCheckedAt: this.readString(renewal.checkedAt) || this.readString(tls.lastRenewalCheckedAt) || null,
      renewalSummary: this.readString(renewal.summary) || this.readString(tls.lastRenewalSummary) || null,
      renewalFailureReason:
        this.readString(renewal.failureReason)
        || this.readString(tls.lastRenewalFailureReason)
        || null,
      followUpProbeStatus: followUpProbeStatus || null,
      followUpProbeRunId: followUpRunId || null,
      followUpProbeJobId:
        this.readString(followUpProbe.serverExecutionJobId)
        || this.readString(tls.lastRenewalFollowUpProbeJobId)
        || null,
      followUpProbeError: this.readString(followUpProbe.error) || null,
    };

    if (!renewalStatus && !followUpProbeStatus) {
      return this.insufficient(rule, `站点 ${site.name} 没有 TLS 续期记录`, value);
    }

    if (renewalStatus === 'failed') {
      return this.firing(
        rule,
        `站点 ${site.name} TLS 续期失败${value.renewalSummary ? `: ${value.renewalSummary}` : ''}`,
        value,
      );
    }

    if (followUpProbeStatus === 'failed') {
      return this.firing(
        rule,
        `站点 ${site.name} TLS 续期后证书探测失败${value.followUpProbeError ? `: ${value.followUpProbeError}` : ''}`,
        value,
      );
    }

    return this.ok(rule, `站点 ${site.name} TLS 续期链路未发现失败`, value);
  }

  private async evaluateSiteSmokeCheckFailure(rule: AlertRuleRecord): Promise<EvaluationResult> {
    const site = rule.site;
    if (!site) {
      return this.insufficient(rule, '规则未绑定站点目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowRuns = readPositiveInt(condition.windowRuns, 3, 1, 20);
    const failureThreshold = readPositiveInt(condition.failureThreshold, 1, 1, windowRuns);
    const includeDryRun = this.readBoolean(condition.includeDryRun) === true;
    const runs = await this.prisma.siteSyncRun.findMany({
      where: {
        teamId: rule.teamId,
        siteId: site.id,
        mode: 'smoke_check',
        dryRun: includeDryRun ? undefined : false,
      },
      orderBy: { startedAt: 'desc' },
      take: windowRuns,
      select: {
        id: true,
        status: true,
        dryRun: true,
        trigger: true,
        targetConfigPath: true,
        serverExecutionJobId: true,
        startedAt: true,
        finishedAt: true,
        error: true,
        result: true,
        warnings: true,
      },
    });
    const completedRuns = runs.filter((run) => run.status === 'completed' || this.isFailureStatus(run.status));
    const failedRuns = completedRuns.filter((run) => this.isFailureStatus(run.status));
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      windowRuns,
      failureThreshold,
      includeDryRun,
      runCount: runs.length,
      completedRunCount: completedRuns.length,
      failureCount: failedRuns.length,
      latestRuns: runs.map((run) => this.serializeSiteSmokeCheckRun(run)),
    };

    if (!runs.length) {
      return this.insufficient(rule, `站点 ${site.name} 暂无 Smoke 检查记录`, value);
    }

    if (!completedRuns.length) {
      return this.insufficient(rule, `站点 ${site.name} 最近 Smoke 检查仍未结束`, value);
    }

    if (failedRuns.length >= failureThreshold) {
      const latestFailure = failedRuns[0];
      return this.firing(
        rule,
        `站点 ${site.name} 最近 ${completedRuns.length} 次 Smoke 检查失败 ${failedRuns.length} 次`
          + `${latestFailure.error ? `: ${latestFailure.error}` : ''}`,
        value,
      );
    }

    return this.ok(
      rule,
      `站点 ${site.name} 最近 ${completedRuns.length} 次 Smoke 检查未达到失败阈值`,
      value,
    );
  }

  private serializeSiteSmokeCheckRun(run: {
    id: string;
    status: string;
    dryRun: boolean;
    trigger: string;
    targetConfigPath: string | null;
    serverExecutionJobId: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    error: string | null;
    result: unknown;
    warnings: unknown;
  }) {
    const result = this.asRecord(run.result);
    const warnings = this.readStringArray(run.warnings);
    return {
      id: run.id,
      status: run.status,
      dryRun: run.dryRun,
      trigger: run.trigger,
      targetConfigPath: run.targetConfigPath,
      serverExecutionJobId: run.serverExecutionJobId,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() || null,
      error: run.error,
      resultStatus: this.readString(result.status) || null,
      resultSummary: this.readString(result.summary) || this.readString(result.message) || null,
      warningCount: warnings.length,
      warnings: warnings.slice(0, 5),
    };
  }

  private async evaluateDeploymentSmokeCheckFailure(rule: AlertRuleRecord): Promise<EvaluationResult> {
    if (!rule.projectId) {
      return this.insufficient(rule, '规则未绑定项目部署目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowRuns = readPositiveInt(condition.windowRuns, 3, 1, 20);
    const failureThreshold = readPositiveInt(condition.failureThreshold, 1, 1, windowRuns);
    const includeDryRun = this.readBoolean(condition.includeDryRun) === true;
    const runs = await this.prisma.deploymentRun.findMany({
      where: {
        teamId: rule.teamId,
        projectId: rule.projectId,
        environmentId: rule.environmentId ?? undefined,
        applicationId: rule.applicationId ?? undefined,
        applicationServiceId: rule.applicationServiceId ?? undefined,
        mode: 'smoke_check',
        dryRun: includeDryRun ? undefined : false,
      },
      orderBy: { startedAt: 'desc' },
      take: windowRuns,
      select: {
        id: true,
        status: true,
        dryRun: true,
        source: true,
        trigger: true,
        sourceRunId: true,
        serverExecutionJobId: true,
        healthCheckUrl: true,
        startedAt: true,
        finishedAt: true,
        error: true,
        result: true,
      },
    });
    const completedRuns = runs.filter((run) => run.status === 'completed' || this.isFailureStatus(run.status));
    const failedRuns = completedRuns.filter((run) => this.isFailureStatus(run.status));
    const projectName = rule.project?.name || '项目部署';
    const value = {
      projectId: rule.projectId,
      projectName,
      environmentId: rule.environmentId,
      applicationId: rule.applicationId,
      applicationServiceId: rule.applicationServiceId,
      windowRuns,
      failureThreshold,
      includeDryRun,
      runCount: runs.length,
      completedRunCount: completedRuns.length,
      failureCount: failedRuns.length,
      latestRuns: runs.map((run) => this.serializeDeploymentSmokeCheckRun(run)),
    };

    if (!runs.length) {
      return this.insufficient(rule, `${projectName} 暂无部署 Smoke 检查记录`, value);
    }

    if (!completedRuns.length) {
      return this.insufficient(rule, `${projectName} 最近部署 Smoke 检查仍未结束`, value);
    }

    if (failedRuns.length >= failureThreshold) {
      const latestFailure = failedRuns[0];
      return this.firing(
        rule,
        `${projectName} 最近 ${completedRuns.length} 次部署 Smoke 检查失败 ${failedRuns.length} 次`
          + `${latestFailure.error ? `: ${latestFailure.error}` : ''}`,
        value,
      );
    }

    return this.ok(
      rule,
      `${projectName} 最近 ${completedRuns.length} 次部署 Smoke 检查未达到失败阈值`,
      value,
    );
  }

  private serializeDeploymentSmokeCheckRun(run: {
    id: string;
    status: string;
    dryRun: boolean;
    source: string;
    trigger: string;
    sourceRunId: string | null;
    serverExecutionJobId: string | null;
    healthCheckUrl: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    error: string | null;
    result: unknown;
  }) {
    const result = this.asRecord(run.result);
    return {
      id: run.id,
      status: run.status,
      dryRun: run.dryRun,
      source: run.source,
      trigger: run.trigger,
      sourceRunId: run.sourceRunId,
      serverExecutionJobId: run.serverExecutionJobId,
      healthCheckUrl: run.healthCheckUrl,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() || null,
      error: run.error,
      resultStatus: this.readString(result.status) || null,
      resultSummary: this.readString(result.summary) || this.readString(result.message) || null,
    };
  }

  private async evaluateCloudProviderSyncFailure(rule: AlertRuleRecord): Promise<EvaluationResult> {
    const condition = this.asRecord(rule.condition);
    const provider = this.readString(condition.provider);
    const windowRuns = readPositiveInt(condition.windowRuns, 5, 1, 20);
    const failureThreshold = readPositiveInt(condition.failureThreshold, 2, 1, windowRuns);
    const includeConfigFallback = condition.includeConfigFallback === true;
    const queryTake = Math.min(Math.max(windowRuns * 10, 20), 100);
    const runs = await this.prisma.resourceSyncRun.findMany({
      where: {
        teamId: rule.teamId,
        sourceType: 'cloud',
        provider: provider && provider !== 'all' ? { in: [provider, 'all'] } : undefined,
      },
      orderBy: { startedAt: 'desc' },
      take: queryTake,
      select: {
        id: true,
        provider: true,
        status: true,
        error: true,
        discovered: true,
        metadata: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    const scopedRuns = runs
      .filter((run) => this.isCloudSyncRunInRuleScope(rule, this.asRecord(run.metadata)))
      .slice(0, windowRuns);

    if (!scopedRuns.length) {
      return this.insufficient(rule, '没有可评估的云资源同步记录', {
        provider: provider || 'all',
        windowRuns,
        failureThreshold,
      });
    }

    const providerFailures: CloudSyncFailureSample[] = [];
    const configFallbacks: CloudSyncFailureSample[] = [];
    const latestRuns = scopedRuns.map((run) => {
      const metadata = this.asRecord(run.metadata);
      const providerDiagnostics = this.readProviderDiagnostics(metadata.providers)
        .filter((diagnostic) => this.providerMatches(provider, diagnostic.provider));

      if (run.status === 'failed') {
        providerFailures.push({
          runId: run.id,
          provider: provider && provider !== 'all' ? provider : run.provider,
          status: run.status,
          reason: run.error || 'cloud sync failed',
          startedAt: run.startedAt,
        });
      }

      providerDiagnostics.forEach((diagnostic) => {
        if (this.isLiveProviderFailure(diagnostic)) {
          providerFailures.push({
            runId: run.id,
            provider: diagnostic.provider,
            status: run.status,
            reason: diagnostic.fallbackReason || diagnostic.errors[0] || 'provider live inventory failed',
            startedAt: run.startedAt,
            fallbackReason: diagnostic.fallbackReason,
            errors: diagnostic.errors,
          });
          return;
        }

        if (this.isConfigFallback(diagnostic)) {
          const sample = {
            runId: run.id,
            provider: diagnostic.provider,
            status: run.status,
            reason: diagnostic.fallbackReason || 'provider inventory used fallback',
            startedAt: run.startedAt,
            fallbackReason: diagnostic.fallbackReason,
            errors: diagnostic.errors,
          };
          if (includeConfigFallback) {
            providerFailures.push(sample);
          } else {
            configFallbacks.push(sample);
          }
        }
      });

      return {
        id: run.id,
        provider: run.provider,
        status: run.status,
        discovered: run.discovered,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        providerDiagnostics: providerDiagnostics.map((diagnostic) => ({
          provider: diagnostic.provider,
          live: diagnostic.live,
          syncMode: diagnostic.syncMode,
          fallbackReason: diagnostic.fallbackReason,
          errorCount: diagnostic.errors.length,
        })),
      };
    });
    const value = {
      provider: provider || 'all',
      windowRuns,
      failureThreshold,
      includeConfigFallback,
      evaluatedRuns: scopedRuns.length,
      failureCount: providerFailures.length,
      configFallbackCount: configFallbacks.length,
      failures: providerFailures.slice(0, 5),
      configFallbacks: configFallbacks.slice(0, 5),
      latestRuns,
    };

    if (providerFailures.length >= failureThreshold) {
      return this.firing(
        rule,
        `最近 ${scopedRuns.length} 次云同步中有 ${providerFailures.length} 次 provider 失败，达到阈值 ${failureThreshold}`,
        value,
      );
    }

    if (providerFailures.length > 0) {
      return this.ok(
        rule,
        `最近云同步有 ${providerFailures.length} 次 provider 失败，未达到阈值 ${failureThreshold}`,
        value,
      );
    }

    if (configFallbacks.length > 0) {
      return this.ok(
        rule,
        `最近云同步没有 provider 失败，但有 ${configFallbacks.length} 次配置 fallback`,
        value,
      );
    }

    return this.ok(rule, '最近云资源同步 provider 状态正常', value);
  }

  private async evaluateResourceMetricThreshold(rule: AlertRuleRecord): Promise<EvaluationResult> {
    const condition = this.asRecord(rule.condition);
    const metricName = this.readString(condition.metricName) || 'cpuPercent';
    const metricField = resourceMetricFields[metricName];
    if (!metricField) {
      return this.insufficient(rule, `不支持的资源指标字段: ${metricName}`, {
        metricName,
        supportedMetrics: Object.keys(resourceMetricFields),
      });
    }

    const threshold = this.readFiniteNumber(condition.threshold);
    if (threshold === undefined) {
      return this.insufficient(rule, '资源指标阈值规则缺少 threshold', {
        metricName,
        supportedMetrics: Object.keys(resourceMetricFields),
      });
    }

    const windowMinutes = readPositiveInt(condition.windowMinutes, 60, 1, 10080);
    const aggregation = this.normalizeMetricAggregation(condition.aggregation);
    const operator = this.normalizeMetricOperator(condition.operator);
    const metricSource = this.readString(condition.metricSource) || 'docker_stats';
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const where: Prisma.ResourceMetricSnapshotWhereInput = {
      teamId: rule.teamId,
      resourceId: rule.managedResourceId ?? undefined,
      projectId: rule.projectId ?? undefined,
      environmentId: rule.environmentId ?? undefined,
      metricSource,
      sampledAt: { gte: from, lte: to },
    };
    (where as Record<string, unknown>)[metricField.key] = { not: null };

    const snapshots = await this.prisma.resourceMetricSnapshot.findMany({
      where,
      orderBy: { sampledAt: 'desc' },
      take: 500,
      select: {
        id: true,
        resourceId: true,
        sampledAt: true,
        status: true,
        metricSource: true,
        cpuPercent: true,
        memoryPercent: true,
        memoryUsageBytes: true,
        networkInputBytes: true,
        networkOutputBytes: true,
        blockInputBytes: true,
        blockOutputBytes: true,
        pids: true,
        resource: {
          select: {
            id: true,
            name: true,
            provider: true,
            kind: true,
            sourceType: true,
          },
        },
      },
    });
    const samples = snapshots
      .map((snapshot) => ({
        id: snapshot.id,
        resourceId: snapshot.resourceId,
        resourceName: snapshot.resource?.name || snapshot.resourceId,
        sampledAt: snapshot.sampledAt,
        status: snapshot.status,
        value: this.readFiniteNumber((snapshot as unknown as Record<string, unknown>)[metricField.key]),
      }))
      .filter((sample): sample is {
        id: string;
        resourceId: string;
        resourceName: string;
        sampledAt: Date;
        status: string;
        value: number;
      } => sample.value !== undefined);

    if (!samples.length) {
      return this.insufficient(rule, `最近 ${windowMinutes} 分钟没有可评估的${metricField.label}指标快照`, {
        metricName,
        metricLabel: metricField.label,
        metricSource,
        windowMinutes,
        from,
        to,
        threshold,
        operator,
        aggregation,
      });
    }

    const evaluatedValue = this.aggregateMetricValues(samples.map((sample) => sample.value), aggregation);
    const firing = this.compareMetricValue(evaluatedValue, threshold, operator);
    const latestSample = samples[0];
    const value = {
      metricName,
      metricLabel: metricField.label,
      metricSource,
      unit: metricField.unit,
      windowMinutes,
      from,
      to,
      aggregation,
      operator,
      threshold,
      value: evaluatedValue,
      sampleCount: samples.length,
      resourceId: rule.managedResourceId || null,
      latestSample: {
        id: latestSample.id,
        resourceId: latestSample.resourceId,
        resourceName: latestSample.resourceName,
        sampledAt: latestSample.sampledAt,
        value: latestSample.value,
        status: latestSample.status,
      },
      recentSamples: samples.slice(0, 5).map((sample) => ({
        id: sample.id,
        resourceId: sample.resourceId,
        resourceName: sample.resourceName,
        sampledAt: sample.sampledAt,
        value: sample.value,
      })),
    };
    const formattedValue = this.formatMetricValue(evaluatedValue, metricField.unit);
    const formattedThreshold = this.formatMetricValue(threshold, metricField.unit);
    const operatorLabel = this.metricOperatorLabel(operator);

    if (firing) {
      return this.firing(
        rule,
        `最近 ${windowMinutes} 分钟${metricField.label}${this.metricAggregationLabel(aggregation)} ${formattedValue} ${operatorLabel} ${formattedThreshold}`,
        value,
      );
    }

    return this.ok(
      rule,
      `最近 ${windowMinutes} 分钟${metricField.label}${this.metricAggregationLabel(aggregation)} ${formattedValue} 未达到阈值 ${operatorLabel} ${formattedThreshold}`,
      value,
    );
  }

  private async evaluateServiceSloBreach(rule: AlertRuleRecord): Promise<EvaluationResult> {
    if (!rule.applicationServiceId) {
      return this.insufficient(rule, '规则未绑定服务目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowSpecs = this.readServiceSloWindowSpecs(condition);
    const matchPolicy = this.readServiceSloMatchPolicy(condition, windowSpecs.length);
    const strategy = this.readString(condition.strategy) || (windowSpecs.length > 1 ? 'multi_window_burn_rate' : 'single_window');
    const maxWindowMinutes = Math.max(...windowSpecs.map((window) => window.windowMinutes));
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - maxWindowMinutes * 60 * 1000);
    const service = await this.prisma.applicationService.findFirst({
      where: {
        id: rule.applicationServiceId,
        teamId: rule.teamId,
      },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        name: true,
        kind: true,
        status: true,
        runtime: true,
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
        application: { select: { id: true, name: true, status: true } },
      },
    });

    if (!service) {
      return this.insufficient(rule, '服务目标不存在', {
        serviceId: rule.applicationServiceId,
        maxWindowMinutes,
        targetPercent: windowSpecs[0]?.targetPercent ?? 99,
      });
    }

    const [deploymentRuns, operationRuns, alertEvents] = await Promise.all([
      this.prisma.deploymentRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.applicationServiceOperationRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          action: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          occurredAt: { gte: from, lte: generatedAt },
          status: { in: ['firing', 'error', 'suppressed'] },
          metric: { notIn: serviceSloDerivedMetrics },
        },
        select: {
          id: true,
          applicationServiceId: true,
          severity: true,
          status: true,
          occurredAt: true,
        },
      }),
    ]);
    const windowEvaluations = windowSpecs.map((window) => (
      this.evaluateServiceSloWindow(
        service,
        deploymentRuns,
        operationRuns,
        alertEvents,
        window,
        generatedAt,
      )
    ));
    const primaryWindow = windowEvaluations[0];
    const firingWindows = windowEvaluations.filter((window) => window.status === 'firing');
    const noDataWindows = windowEvaluations.filter((window) => window.status === 'no_data');
    const value = {
      serviceId: service.id,
      serviceName: service.name,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      strategy,
      matchPolicy,
      maxWindowMinutes,
      windowCount: windowEvaluations.length,
      windowMinutes: primaryWindow.windowMinutes,
      targetPercent: primaryWindow.targetPercent,
      burnRateThreshold: primaryWindow.burnRateThreshold,
      status: primaryWindow.status,
      statusReason: primaryWindow.statusReason,
      sloPercent: primaryWindow.sloPercent,
      errorBudgetRemainingPercent: primaryWindow.errorBudgetRemainingPercent,
      burnRate: primaryWindow.burnRate,
      deploymentCount: primaryWindow.deploymentCount,
      deploymentFailureCount: primaryWindow.deploymentFailureCount,
      operationCount: primaryWindow.operationCount,
      operationFailureCount: primaryWindow.operationFailureCount,
      alertImpactCount: primaryWindow.alertImpactCount,
      criticalAlertCount: primaryWindow.criticalAlertCount,
      windows: windowEvaluations.map((window) => ({
        label: window.label,
        windowMinutes: window.windowMinutes,
        targetPercent: window.targetPercent,
        burnRateThreshold: window.burnRateThreshold,
        status: window.status,
        statusReason: window.statusReason,
        from: window.from,
        to: window.to,
        sloPercent: window.sloPercent,
        errorBudgetRemainingPercent: window.errorBudgetRemainingPercent,
        burnRate: window.burnRate,
        deploymentCount: window.deploymentCount,
        deploymentFailureCount: window.deploymentFailureCount,
        operationCount: window.operationCount,
        operationFailureCount: window.operationFailureCount,
        alertImpactCount: window.alertImpactCount,
        criticalAlertCount: window.criticalAlertCount,
        breachReasons: window.breachReasons,
      })),
    };

    if (noDataWindows.length === windowEvaluations.length) {
      return this.insufficient(rule, `${service.name} 在配置的 SLO 窗口内暂无真实 SLO 信号`, value);
    }

    if (matchPolicy === 'all' && firingWindows.length > 0 && noDataWindows.length > 0) {
      return this.insufficient(
        rule,
        `${service.name} SLO 部分窗口缺少信号，无法确认全部窗口策略`,
        value,
      );
    }

    const shouldFire = matchPolicy === 'all'
      ? firingWindows.length === windowEvaluations.length
      : firingWindows.length > 0;

    if (shouldFire) {
      return this.firing(
        rule,
        `${service.name} SLO ${this.formatServiceSloWindowSummary(firingWindows)} 触发${matchPolicy === 'all' ? '全部' : '任一'}窗口策略`,
        value,
      );
    }

    if (firingWindows.length > 0) {
      return this.ok(
        rule,
        `${service.name} SLO ${this.formatServiceSloWindowSummary(firingWindows)} 已违约，但未满足全部窗口策略`,
        value,
      );
    }

    return this.ok(
      rule,
      `${service.name} SLO ${this.formatServiceSloWindowSummary(windowEvaluations)} 均未触发违约`,
      value,
    );
  }

  private async evaluateServiceErrorBudget(rule: AlertRuleRecord): Promise<EvaluationResult> {
    if (!rule.applicationServiceId) {
      return this.insufficient(rule, '规则未绑定服务目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowMinutes = readPositiveInt(condition.windowMinutes, 1440, 30, 43200);
    const targetPercent = this.readPercent(condition.targetPercent, 99, 50, 99.99);
    const remainingThresholdPercent = this.readPercent(condition.remainingThresholdPercent, 25, 0, 100);
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - windowMinutes * 60 * 1000);
    const service = await this.prisma.applicationService.findFirst({
      where: {
        id: rule.applicationServiceId,
        teamId: rule.teamId,
      },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        name: true,
        kind: true,
        status: true,
        runtime: true,
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
        application: { select: { id: true, name: true, status: true } },
      },
    });

    if (!service) {
      return this.insufficient(rule, '服务目标不存在', {
        serviceId: rule.applicationServiceId,
        windowMinutes,
        targetPercent,
        remainingThresholdPercent,
      });
    }

    const [deploymentRuns, operationRuns, alertEvents] = await Promise.all([
      this.prisma.deploymentRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.applicationServiceOperationRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          action: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          occurredAt: { gte: from, lte: generatedAt },
          status: { in: ['firing', 'error', 'suppressed'] },
          metric: { notIn: serviceSloDerivedMetrics },
        },
        select: {
          id: true,
          applicationServiceId: true,
          severity: true,
          status: true,
          occurredAt: true,
        },
      }),
    ]);
    const window = this.evaluateServiceSloWindow(
      service,
      deploymentRuns,
      operationRuns,
      alertEvents,
      {
        label: '错误预算',
        windowMinutes,
        targetPercent,
        burnRateThreshold: 100,
      },
      generatedAt,
    );
    const value = {
      serviceId: service.id,
      serviceName: service.name,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      windowMinutes,
      targetPercent,
      remainingThresholdPercent,
      status: window.status,
      statusReason: window.statusReason,
      sloPercent: window.sloPercent,
      errorBudgetRemainingPercent: window.errorBudgetRemainingPercent,
      burnRate: window.burnRate,
      deploymentCount: window.deploymentCount,
      deploymentFailureCount: window.deploymentFailureCount,
      operationCount: window.operationCount,
      operationFailureCount: window.operationFailureCount,
      alertImpactCount: window.alertImpactCount,
      criticalAlertCount: window.criticalAlertCount,
      from: window.from,
      to: window.to,
    };

    if (window.sloPercent === null || window.errorBudgetRemainingPercent === null) {
      return this.insufficient(rule, `${service.name} 在最近 ${windowMinutes} 分钟内暂无错误预算信号`, value);
    }

    if (window.errorBudgetRemainingPercent <= remainingThresholdPercent) {
      return this.firing(
        rule,
        `${service.name} 错误预算剩余 ${this.formatPercentValue(window.errorBudgetRemainingPercent)} 低于阈值 ${this.formatPercentValue(remainingThresholdPercent)}`,
        value,
      );
    }

    return this.ok(
      rule,
      `${service.name} 错误预算剩余 ${this.formatPercentValue(window.errorBudgetRemainingPercent)} 高于阈值 ${this.formatPercentValue(remainingThresholdPercent)}`,
      value,
    );
  }

  private async evaluateServiceErrorBudgetExhaustion(rule: AlertRuleRecord): Promise<EvaluationResult> {
    if (!rule.applicationServiceId) {
      return this.insufficient(rule, '规则未绑定服务目标', {});
    }

    const condition = this.asRecord(rule.condition);
    const windowMinutes = readPositiveInt(condition.windowMinutes, 1440, 30, 43200);
    const targetPercent = this.readPercent(condition.targetPercent, 99, 50, 99.99);
    const exhaustionWithinMinutes = readPositiveInt(condition.exhaustionWithinMinutes, 1440, 30, 43200);
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - windowMinutes * 60 * 1000);
    const service = await this.prisma.applicationService.findFirst({
      where: {
        id: rule.applicationServiceId,
        teamId: rule.teamId,
      },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        name: true,
        kind: true,
        status: true,
        runtime: true,
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
        application: { select: { id: true, name: true, status: true } },
      },
    });

    if (!service) {
      return this.insufficient(rule, '服务目标不存在', {
        serviceId: rule.applicationServiceId,
        windowMinutes,
        targetPercent,
        exhaustionWithinMinutes,
      });
    }

    const [deploymentRuns, operationRuns, alertEvents] = await Promise.all([
      this.prisma.deploymentRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.applicationServiceOperationRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          action: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          occurredAt: { gte: from, lte: generatedAt },
          status: { in: ['firing', 'error', 'suppressed'] },
          metric: { notIn: serviceSloDerivedMetrics },
        },
        select: {
          id: true,
          applicationServiceId: true,
          severity: true,
          status: true,
          occurredAt: true,
        },
      }),
    ]);
    const window = this.evaluateServiceSloWindow(
      service,
      deploymentRuns,
      operationRuns,
      alertEvents,
      {
        label: '错误预算耗尽预测',
        windowMinutes,
        targetPercent,
        burnRateThreshold: 100,
      },
      generatedAt,
    );
    const burnRate = window.burnRate ?? 0;
    const errorBudgetRemainingPercent = window.errorBudgetRemainingPercent;
    const budgetConsumptionPercentPerMinute = burnRate > 0
      ? (burnRate * 100) / windowMinutes
      : 0;
    const projectedExhaustionMinutes = errorBudgetRemainingPercent === null
      ? null
      : (errorBudgetRemainingPercent <= 0
        ? 0
        : (budgetConsumptionPercentPerMinute > 0
          ? Math.ceil(errorBudgetRemainingPercent / budgetConsumptionPercentPerMinute)
          : null));
    const value = {
      serviceId: service.id,
      serviceName: service.name,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      windowMinutes,
      targetPercent,
      exhaustionWithinMinutes,
      projectedExhaustionMinutes,
      budgetConsumptionPercentPerMinute: Number(budgetConsumptionPercentPerMinute.toFixed(4)),
      status: window.status,
      statusReason: window.statusReason,
      sloPercent: window.sloPercent,
      errorBudgetRemainingPercent,
      burnRate: window.burnRate,
      deploymentCount: window.deploymentCount,
      deploymentFailureCount: window.deploymentFailureCount,
      operationCount: window.operationCount,
      operationFailureCount: window.operationFailureCount,
      alertImpactCount: window.alertImpactCount,
      criticalAlertCount: window.criticalAlertCount,
      from: window.from,
      to: window.to,
    };

    if (window.sloPercent === null || errorBudgetRemainingPercent === null) {
      return this.insufficient(rule, `${service.name} 在最近 ${windowMinutes} 分钟内暂无错误预算耗尽预测信号`, value);
    }

    if (projectedExhaustionMinutes === 0) {
      return this.firing(
        rule,
        `${service.name} 错误预算已耗尽，当前 burn rate ${window.burnRate ?? 0}`,
        value,
      );
    }

    if (projectedExhaustionMinutes !== null && projectedExhaustionMinutes <= exhaustionWithinMinutes) {
      return this.firing(
        rule,
        `${service.name} 错误预算预计 ${projectedExhaustionMinutes} 分钟内耗尽，阈值 ${exhaustionWithinMinutes} 分钟`,
        value,
      );
    }

    if (projectedExhaustionMinutes === null) {
      return this.ok(
        rule,
        `${service.name} 当前没有错误预算消耗，剩余 ${this.formatPercentValue(errorBudgetRemainingPercent)}`,
        value,
      );
    }

    return this.ok(
      rule,
      `${service.name} 错误预算预计 ${projectedExhaustionMinutes} 分钟后耗尽，高于阈值 ${exhaustionWithinMinutes} 分钟`,
      value,
    );
  }

  private readServiceSloWindowSpecs(condition: Record<string, unknown>): ServiceSloWindowSpec[] {
    const fallbackTargetPercent = this.readPercent(condition.targetPercent, 99, 50, 99.99);
    const fallbackBurnRateThreshold = this.readPercent(condition.burnRateThreshold, 1, 0.1, 100);
    const rawWindows = Array.isArray(condition.windows) ? condition.windows : [];
    const windows = rawWindows
      .slice(0, 4)
      .map((item, index) => {
        const window = this.asRecord(item);
        if (!Object.keys(window).length) return null;
        return {
          label: this.readString(window.label) || `窗口 ${index + 1}`,
          windowMinutes: readPositiveInt(window.windowMinutes, index === 0 ? 60 : 360, 30, 43200),
          targetPercent: this.readPercent(window.targetPercent, fallbackTargetPercent, 50, 99.99),
          burnRateThreshold: this.readPercent(window.burnRateThreshold, fallbackBurnRateThreshold, 0.1, 100),
        };
      })
      .filter((window): window is ServiceSloWindowSpec => Boolean(window));

    if (windows.length > 0) {
      return windows;
    }

    return [{
      label: '主窗口',
      windowMinutes: readPositiveInt(condition.windowMinutes, 1440, 30, 43200),
      targetPercent: fallbackTargetPercent,
      burnRateThreshold: fallbackBurnRateThreshold,
    }];
  }

  private readServiceSloMatchPolicy(
    condition: Record<string, unknown>,
    windowCount: number,
  ): ServiceSloMatchPolicy {
    const policy = this.readString(condition.matchPolicy);
    if (policy === 'all' || policy === 'any') {
      return policy;
    }
    const strategy = this.readString(condition.strategy);
    return strategy === 'multi_window_burn_rate' && windowCount > 1 ? 'all' : 'any';
  }

  private evaluateServiceSloWindow(
    service: ServiceSloServiceRecord,
    deploymentRuns: ServiceSloDeploymentRun[],
    operationRuns: ServiceSloOperationRun[],
    alertEvents: ServiceSloAlertEvent[],
    window: ServiceSloWindowSpec,
    generatedAt: Date,
  ): ServiceSloWindowEvaluation {
    const from = new Date(generatedAt.getTime() - window.windowMinutes * 60 * 1000);
    const row = this.buildServiceSloDashboardRows(
      [service],
      deploymentRuns.filter((run) => run.startedAt >= from && run.startedAt <= generatedAt),
      operationRuns.filter((run) => run.startedAt >= from && run.startedAt <= generatedAt),
      alertEvents.filter((event) => event.occurredAt >= from && event.occurredAt <= generatedAt),
      window.targetPercent,
    )[0];

    if (!row || row.sloPercent === null) {
      return {
        ...window,
        status: 'no_data',
        statusReason: '窗口内暂无服务 SLO 信号',
        from,
        to: generatedAt,
        sloPercent: null,
        errorBudgetRemainingPercent: null,
        burnRate: null,
        deploymentCount: row?.deploymentCount ?? 0,
        deploymentFailureCount: row?.deploymentFailureCount ?? 0,
        operationCount: row?.operationCount ?? 0,
        operationFailureCount: row?.operationFailureCount ?? 0,
        alertImpactCount: row?.alertImpactCount ?? 0,
        criticalAlertCount: row?.criticalAlertCount ?? 0,
        breachReasons: [],
      };
    }

    const breachReasons: string[] = [];
    if (row.criticalAlertCount > 0) {
      breachReasons.push(`${row.criticalAlertCount} 个严重服务告警`);
    }
    if (row.burnRate !== null && row.burnRate >= window.burnRateThreshold) {
      breachReasons.push(`burn rate ${row.burnRate} >= ${window.burnRateThreshold}`);
    }
    if (row.sloPercent < window.targetPercent) {
      breachReasons.push(`SLO ${this.formatPercentValue(row.sloPercent)} < ${this.formatPercentValue(window.targetPercent)}`);
    }

    return {
      ...window,
      status: breachReasons.length > 0 ? 'firing' : 'ok',
      statusReason: breachReasons.length > 0 ? breachReasons.join('；') : row.statusReason,
      from,
      to: generatedAt,
      sloPercent: row.sloPercent,
      errorBudgetRemainingPercent: row.errorBudgetRemainingPercent,
      burnRate: row.burnRate,
      deploymentCount: row.deploymentCount,
      deploymentFailureCount: row.deploymentFailureCount,
      operationCount: row.operationCount,
      operationFailureCount: row.operationFailureCount,
      alertImpactCount: row.alertImpactCount,
      criticalAlertCount: row.criticalAlertCount,
      breachReasons,
    };
  }

  private formatServiceSloWindowSummary(windows: ServiceSloWindowEvaluation[]) {
    return windows
      .map((window) => `${window.label}/${window.windowMinutes}m burn ${window.burnRate ?? '-'} 阈值 ${window.burnRateThreshold}`)
      .join('，');
  }

  private evaluateBackup(rule: AlertRuleRecord): EvaluationResult {
    const backupPlan = rule.backupPlan;

    if (!backupPlan) {
      return this.insufficient(rule, '规则未绑定备份计划', {});
    }

    const value = {
      backupPlanId: backupPlan.id,
      backupPlanName: backupPlan.name,
      planStatus: backupPlan.status,
      lastStatus: backupPlan.lastStatus,
      lastRunAt: backupPlan.lastRunAt,
    };

    if (!backupPlan.lastStatus) {
      return this.insufficient(rule, `备份计划 ${backupPlan.name} 尚无运行记录`, value);
    }

    if (['failed', 'blocked'].includes(backupPlan.lastStatus)) {
      return this.firing(rule, `备份计划 ${backupPlan.name} 最近运行 ${backupPlan.lastStatus}`, value);
    }

    return this.ok(rule, `备份计划 ${backupPlan.name} 最近运行正常`, value);
  }

  private async evaluateDeployment(rule: AlertRuleRecord): Promise<EvaluationResult> {
    const latest = await this.prisma.deploymentRun.findFirst({
      where: {
        teamId: rule.teamId,
        projectId: rule.projectId ?? undefined,
        environmentId: rule.environmentId ?? undefined,
        applicationId: rule.applicationId ?? undefined,
        applicationServiceId: rule.applicationServiceId ?? undefined,
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        source: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        error: true,
      },
    });

    if (!latest) {
      return this.insufficient(rule, '没有可评估的部署运行记录', {});
    }

    const value = {
      deploymentRunId: latest.id,
      status: latest.status,
      source: latest.source,
      trigger: latest.trigger,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      error: latest.error,
    };

    if (['failed', 'blocked'].includes(latest.status)) {
      return this.firing(rule, `最近部署运行 ${latest.status}`, value);
    }

    if (latest.status === 'completed') {
      return this.ok(rule, '最近部署运行正常', value);
    }

    return this.insufficient(rule, `最近部署运行仍为 ${latest.status}`, value);
  }

  private async evaluateLogCount(rule: AlertRuleRecord): Promise<EvaluationResult> {
    const condition = this.asRecord(rule.condition);
    const windowMinutes = readPositiveInt(condition.windowMinutes, 60, 1, 10080);
    const threshold = readPositiveInt(condition.threshold, 1, 1, 100000);
    const levels = this.normalizeLogAlertLevels(rule.metric, condition.levels);
    const streamId = this.readString(condition.streamId);
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const where: Prisma.LogEntryWhereInput = {
      teamId: rule.teamId,
      streamId,
      projectId: rule.projectId ?? undefined,
      environmentId: rule.environmentId ?? undefined,
      applicationId: rule.applicationId ?? undefined,
      applicationServiceId: rule.applicationServiceId ?? undefined,
      serverId: rule.serverId ?? undefined,
      siteId: rule.siteId ?? undefined,
      managedResourceId: rule.managedResourceId ?? undefined,
      backupPlanId: rule.backupPlanId ?? undefined,
      level: { in: levels },
      timestamp: { gte: from, lte: to },
    };

    const [count, groupedLevels, latestEntries] = await Promise.all([
      this.prisma.logEntry.count({ where }),
      this.prisma.logEntry.groupBy({
        by: ['level'],
        where,
        _count: { _all: true },
      }),
      this.prisma.logEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: {
          id: true,
          streamId: true,
          level: true,
          message: true,
          timestamp: true,
          source: true,
        },
      }),
    ]);
    const byLevel = groupedLevels
      .map((item) => ({ level: item.level, count: item._count._all }))
      .sort((left, right) => right.count - left.count || left.level.localeCompare(right.level));
    const value = {
      metric: rule.metric,
      windowMinutes,
      threshold,
      levels,
      streamId: streamId || null,
      from,
      to,
      count,
      byLevel,
      latestEntries: latestEntries.map((entry) => ({
        id: entry.id,
        streamId: entry.streamId,
        level: entry.level,
        source: entry.source,
        timestamp: entry.timestamp,
        message: this.truncate(entry.message, 240),
      })),
    };

    if (count >= threshold) {
      return this.firing(rule, `最近 ${windowMinutes} 分钟 ${levels.join('/')} 日志 ${count} 条，达到阈值 ${threshold}`, value);
    }

    return this.ok(rule, `最近 ${windowMinutes} 分钟 ${levels.join('/')} 日志 ${count} 条，未达到阈值 ${threshold}`, value);
  }

  private ok(
    rule: AlertRuleRecord,
    summary: string,
    value: Record<string, unknown>,
  ): EvaluationResult {
    return {
      status: 'ok',
      eventStatus: 'resolved',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  private firing(
    rule: AlertRuleRecord,
    summary: string,
    value: Record<string, unknown>,
  ): EvaluationResult {
    return {
      status: 'firing',
      eventStatus: 'firing',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  private insufficient(
    rule: AlertRuleRecord,
    summary: string,
    value: Record<string, unknown>,
  ): EvaluationResult {
    return {
      status: 'insufficient_data',
      eventStatus: 'insufficient_data',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  private async writeAlertAudit(
    teamId: string,
    userId: string | null,
    rule: { id: string; name: string } | null,
    event: {
      id: string;
      category: string;
      metric: string;
      severity: string;
      status: string;
      summary: string | null;
      projectId: string | null;
      environmentId: string | null;
      applicationId: string | null;
      applicationServiceId: string | null;
      serverId: string | null;
      siteId: string | null;
      managedResourceId: string | null;
    },
    action = 'alert.evaluate',
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      alertEventId: event.id,
      category: 'alert',
      action,
      targetType: 'alert_event',
      targetId: event.id,
      risk: riskFromAlertSeverity(event.severity),
      status: event.status,
      summary: event.summary || `告警事件 ${event.status}`,
      metadata: {
        ruleId: rule?.id,
        ruleName: rule?.name,
        alertCategory: event.category,
        metric: event.metric,
        severity: event.severity,
      },
    });
  }

  private async writeAlertDedupedAudit(
    teamId: string,
    userId: string | null,
    rule: { id: string; name: string } | null,
    event: AlertEventRecord,
    eventStatus: string,
    summary: string,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      alertEventId: event.id,
      category: 'alert',
      action: 'alert.evaluate.deduped',
      targetType: 'alert_event',
      targetId: event.id,
      risk: riskFromAlertSeverity(event.severity),
      status: eventStatus,
      summary: `告警事件已去重：${summary}`,
      metadata: {
        ruleId: rule?.id,
        ruleName: rule?.name,
        alertCategory: event.category,
        metric: event.metric,
        severity: event.severity,
        dedupedEventId: event.id,
      },
    });
  }

  private defaultMetric(category: string) {
    const defaults: Record<string, string> = {
      service: 'service_status',
      server: 'server_status',
      site: 'site_status',
      resource: 'resource_status',
      backup: 'backup_status',
      deployment: 'deployment_status',
      log: 'log_error_count',
    };
    return defaults[category] || 'health_status';
  }

  private eventMetadata(rule: AlertRuleRecord) {
    return {
      evaluationMode: rule.evaluationMode,
      intervalSeconds: rule.intervalSeconds,
      ruleName: rule.name,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  }

  private readPercent(value: unknown, fallback: number, min: number, max: number) {
    const rawNumber = typeof value === 'number'
      ? value
      : (typeof value === 'string' && value.trim() ? Number(value) : fallback);
    const number = Number.isFinite(rawNumber) ? rawNumber : fallback;
    return Number(Math.min(Math.max(number, min), max).toFixed(2));
  }

  private readFiniteNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }
    return undefined;
  }

  private roundPercent(value: number | null | undefined) {
    return value === null || value === undefined ? null : Number(value.toFixed(2));
  }

  private formatPercentValue(value: number) {
    return `${this.roundPercent(value)}%`;
  }

  private readCertificateExpiry(tls: Record<string, unknown>) {
    const candidates: Array<[string, unknown]> = [
      ['tls.expiresAt', tls.expiresAt],
      ['tls.notAfter', tls.notAfter],
      ['tls.certificateExpiresAt', tls.certificateExpiresAt],
      ['tls.certExpiresAt', tls.certExpiresAt],
    ];
    const certificate = this.asRecord(tls.certificate);
    const cert = this.asRecord(tls.cert);
    candidates.push(
      ['tls.certificate.expiresAt', certificate.expiresAt],
      ['tls.certificate.notAfter', certificate.notAfter],
      ['tls.cert.expiresAt', cert.expiresAt],
      ['tls.cert.notAfter', cert.notAfter],
    );

    for (const [source, value] of candidates) {
      const date = this.parseOptionalDate(value);
      if (date) {
        return {
          expiresAt: date,
          source,
          daysRemaining: Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        };
      }
    }

    return null;
  }

  private readCertificateMetadata(tls: Record<string, unknown>, key: string) {
    return (
      this.readString(tls[key]) ||
      this.readString(this.asRecord(tls.certificate)[key]) ||
      this.readString(this.asRecord(tls.cert)[key])
    );
  }

  private readCertificateAssets(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => this.asRecord(item))
      .filter((asset) => Boolean(this.readString(asset.id)))
      .map((asset) => ({
        id: this.readString(asset.id) || '',
        active: this.readBoolean(asset.active) === true,
        fingerprintSha256: this.readString(asset.fingerprintSha256),
        issuer: this.readString(asset.issuer),
        subject: this.readString(asset.subject),
        serialNumber: this.readString(asset.serialNumber),
        firstSeenAt: this.readString(asset.firstSeenAt),
        lastSeenAt: this.readString(asset.lastSeenAt),
        expiresAt: this.readString(asset.expiresAt),
      }));
  }

  private parseOptionalDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeMetricAggregation(value: unknown) {
    const aggregation = this.readString(value);
    return aggregation && ['latest', 'average', 'max'].includes(aggregation) ? aggregation : 'latest';
  }

  private normalizeMetricOperator(value: unknown) {
    const operator = this.readString(value);
    return operator && ['gte', 'gt', 'lte', 'lt'].includes(operator) ? operator : 'gte';
  }

  private isFailureStatus(status: string) {
    return ['failed', 'blocked', 'error', 'cancelled'].includes(status);
  }

  private aggregateMetricValues(values: number[], aggregation: string) {
    if (aggregation === 'average') {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    if (aggregation === 'max') {
      return Math.max(...values);
    }
    return values[0];
  }

  private compareMetricValue(value: number, threshold: number, operator: string) {
    if (operator === 'gt') return value > threshold;
    if (operator === 'lte') return value <= threshold;
    if (operator === 'lt') return value < threshold;
    return value >= threshold;
  }

  private metricAggregationLabel(aggregation: string) {
    if (aggregation === 'average') return '平均值';
    if (aggregation === 'max') return '峰值';
    return '当前值';
  }

  private metricOperatorLabel(operator: string) {
    const labels: Record<string, string> = {
      gte: '>=',
      gt: '>',
      lte: '<=',
      lt: '<',
    };
    return labels[operator] || '>=';
  }

  private formatMetricValue(value: number, unit: ResourceMetricField['unit']) {
    if (unit === 'percent') {
      return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
    }
    if (unit === 'bytes') {
      return `${Math.round(value)}B`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private normalizeLogAlertLevels(metric: string, value: unknown) {
    const requested = this.readStringArray(value)
      .map((item) => item.toLowerCase())
      .filter((item) => ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(item));
    if (requested.length > 0) {
      return [...new Set(requested)];
    }
    if (metric === 'log_fatal_count') return ['fatal'];
    if (metric === 'log_warning_count') return ['warn', 'error', 'fatal'];
    return ['error', 'fatal'];
  }

  private readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : undefined;
  }

  private isCloudSyncRunInRuleScope(rule: AlertRuleRecord, metadata: Record<string, unknown>) {
    if (rule.projectId && metadata.projectId !== rule.projectId) {
      return false;
    }
    if (rule.environmentId && metadata.environmentId !== rule.environmentId) {
      return false;
    }
    return true;
  }

  private readProviderDiagnostics(value: unknown): CloudSyncProviderDiagnostic[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item): CloudSyncProviderDiagnostic | null => {
        const record = this.asRecord(item);
        const provider = this.readString(record.provider);
        if (!provider) return null;
        return {
          provider,
          syncMode: this.readString(record.syncMode),
          fallbackReason: this.readString(record.fallbackReason),
          live: this.readBoolean(record.live),
          errors: this.readStringArray(record.errors),
        };
      })
      .filter((item): item is CloudSyncProviderDiagnostic => Boolean(item));
  }

  private providerMatches(ruleProvider: string | undefined, provider: string) {
    return !ruleProvider || ruleProvider === 'all' || ruleProvider === provider;
  }

  private isLiveProviderFailure(diagnostic: CloudSyncProviderDiagnostic) {
    if (diagnostic.errors.length > 0) {
      return true;
    }
    if (!diagnostic.fallbackReason) {
      return false;
    }
    return /(live inventory failed|timeout|timed out|rate|throttl|quota|denied|unauthorized|forbidden|provider.*failed|request.*failed|network|econn|etimedout)/i
      .test(diagnostic.fallbackReason);
  }

  private isConfigFallback(diagnostic: CloudSyncProviderDiagnostic) {
    return diagnostic.syncMode === 'cloud_inventory_stub_fallback' ||
      diagnostic.live === false ||
      Boolean(diagnostic.fallbackReason);
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }

}
