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
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
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
import { MonitoringService } from './monitoring.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableMonitoringRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  rule?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  channel?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  alertEvent?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
};

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get('alert-rules')
  async listRules(
    @Request() req: AuthRequest,
    @Query() query: ListAlertRulesQueryDto,
  ) {
    const rules = await this.monitoringService.listRules(req.teamId, query);
    const readableRules = await this.filterReadableMonitoringRecords(
      req,
      rules,
      'monitoring.rule.read',
      'alert_rule',
    );
    return Promise.all(readableRules.map(async (rule) => ({
      ...rule,
      events: await this.filterReadableMonitoringRecords(
        req,
        rule.events ?? [],
        'monitoring.event.read',
        'alert_event',
      ),
    })));
  }

  @Post('alert-rules')
  async createRule(
    @Request() req: AuthRequest,
    @Body() dto: CreateAlertRuleDto,
  ) {
    const scope = await this.monitoringService.resolveRuleCreateAccessScope(req.teamId, dto);
    await this.assertCanWriteMonitoring(req, 'monitoring.rule.create', null, scope.projectId, scope.environmentId, 'medium');
    return this.monitoringService.createRule(req.teamId, req.user.id, dto);
  }

  @Put('alert-rules/:ruleId')
  async updateRule(
    @Request() req: AuthRequest,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    const scope = await this.monitoringService.getRuleAccessScope(req.teamId, ruleId);
    await this.assertCanWriteMonitoring(req, 'monitoring.rule.update', ruleId, scope.projectId, scope.environmentId, 'medium');
    return this.monitoringService.updateRule(req.teamId, ruleId, dto);
  }

  @Post('alert-rules/:ruleId/evaluate')
  async evaluateRule(
    @Request() req: AuthRequest,
    @Param('ruleId') ruleId: string,
    @Body() dto: EvaluateAlertRuleDto,
  ) {
    const scope = await this.monitoringService.getRuleAccessScope(req.teamId, ruleId);
    await this.assertCanWriteMonitoring(req, 'monitoring.rule.evaluate', ruleId, scope.projectId, scope.environmentId, 'low');
    return this.monitoringService.evaluateRule(req.teamId, req.user.id, ruleId, dto);
  }

  @Get('alert-events')
  async listEvents(
    @Request() req: AuthRequest,
    @Query() query: ListAlertEventsQueryDto,
  ) {
    const events = await this.monitoringService.listEvents(req.teamId, query);
    return this.filterReadableMonitoringRecords(req, events, 'monitoring.event.read', 'alert_event');
  }

  @Get('resource-metrics/dashboard')
  async getResourceMetricDashboard(
    @Request() req: AuthRequest,
    @Query() query: ListResourceMetricDashboardQueryDto,
  ) {
    const dashboard = await this.monitoringService.listResourceMetricDashboardRows(req.teamId, query);
    const readableRows = await this.filterReadableMonitoringRecords(
      req,
      dashboard.rows,
      'monitoring.resource_metric_dashboard.read',
      'resource_metric_dashboard',
    );
    return this.monitoringService.summarizeResourceMetricDashboard(
      readableRows,
      dashboard.windowMinutes,
      dashboard.staleAfterMinutes,
      dashboard.generatedAt,
    );
  }

  @Get('service-slo/templates')
  listServiceSloRuleTemplates() {
    return this.monitoringService.listServiceSloRuleTemplates();
  }

  @Get('service-slo/dashboard')
  async getServiceSloDashboard(
    @Request() req: AuthRequest,
    @Query() query: ListServiceSloDashboardQueryDto,
  ) {
    const dashboard = await this.monitoringService.listServiceSloDashboardRows(req.teamId, query);
    const readableRows = await this.filterReadableMonitoringRecords(
      req,
      dashboard.rows,
      'monitoring.service_slo_dashboard.read',
      'service_slo_dashboard',
    );
    return this.monitoringService.summarizeServiceSloDashboard(
      readableRows,
      dashboard.windowMinutes,
      dashboard.targetPercent,
      dashboard.generatedAt,
    );
  }

  @Get('silences')
  async listSilences(
    @Request() req: AuthRequest,
    @Query() query: ListAlertSilencesQueryDto,
  ) {
    const silences = await this.monitoringService.listSilences(req.teamId, query);
    return this.filterReadableMonitoringRecords(
      req,
      silences,
      'monitoring.silence.read',
      'alert_silence',
    );
  }

  @Post('silences')
  async createSilence(
    @Request() req: AuthRequest,
    @Body() dto: CreateAlertSilenceDto,
  ) {
    const scope = await this.monitoringService.resolveSilenceScope(req.teamId, dto);
    await this.assertCanWriteMonitoring(
      req,
      'monitoring.silence.create',
      null,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.monitoringService.createSilence(req.teamId, req.user.id, dto);
  }

  @Put('silences/:silenceId')
  async updateSilence(
    @Request() req: AuthRequest,
    @Param('silenceId') silenceId: string,
    @Body() dto: UpdateAlertSilenceDto,
  ) {
    const currentScope = await this.monitoringService.getSilenceAccessScope(req.teamId, silenceId);
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.monitoringService.resolveSilenceScope(req.teamId, dto);
      await this.assertCanWriteMonitoring(
        req,
        'monitoring.silence.update',
        silenceId,
        targetScope.projectId,
        targetScope.environmentId,
        'medium',
      );
    }
    await this.assertCanWriteMonitoring(
      req,
      'monitoring.silence.update',
      silenceId,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    return this.monitoringService.updateSilence(req.teamId, silenceId, dto);
  }

  @Get('notification-channels')
  async listNotificationChannels(@Request() req: AuthRequest) {
    const channels = await this.monitoringService.listNotificationChannels(req.teamId);
    return this.filterReadableMonitoringRecords(
      req,
      channels,
      'monitoring.notification_channel.read',
      'alert_notification_channel',
    );
  }

  @Post('notification-channels')
  async createNotificationChannel(
    @Request() req: AuthRequest,
    @Body() dto: CreateAlertNotificationChannelDto,
  ) {
    const scope = await this.monitoringService.resolveNotificationChannelScope(req.teamId, dto);
    await this.assertCanWriteMonitoring(
      req,
      'monitoring.notification_channel.create',
      null,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.monitoringService.createNotificationChannel(req.teamId, req.user.id, dto);
  }

  @Put('notification-channels/:channelId')
  async updateNotificationChannel(
    @Request() req: AuthRequest,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateAlertNotificationChannelDto,
  ) {
    const currentScope = await this.monitoringService.getNotificationChannelAccessScope(req.teamId, channelId);
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.monitoringService.resolveNotificationChannelScope(req.teamId, dto);
      await this.assertCanWriteMonitoring(
        req,
        'monitoring.notification_channel.update',
        channelId,
        targetScope.projectId,
        targetScope.environmentId,
        'medium',
      );
    }
    await this.assertCanWriteMonitoring(
      req,
      'monitoring.notification_channel.update',
      channelId,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    return this.monitoringService.updateNotificationChannel(req.teamId, channelId, dto);
  }

  @Get('notification-deliveries')
  async listNotificationDeliveries(
    @Request() req: AuthRequest,
    @Query() query: ListAlertNotificationDeliveriesQueryDto,
  ) {
    const deliveries = await this.monitoringService.listNotificationDeliveries(req.teamId, query);
    return this.filterReadableMonitoringRecords(
      req,
      deliveries,
      'monitoring.notification_delivery.read',
      'alert_notification_delivery',
    );
  }

  @Post('notification-deliveries/:deliveryId/retry')
  async retryNotificationDelivery(
    @Request() req: AuthRequest,
    @Param('deliveryId') deliveryId: string,
  ) {
    const scope = await this.monitoringService.getNotificationDeliveryAccessScope(req.teamId, deliveryId);
    await this.assertCanWriteMonitoring(
      req,
      'monitoring.notification_delivery.retry',
      deliveryId,
      scope.projectId,
      scope.environmentId,
      'low',
    );
    return this.monitoringService.retryNotificationDelivery(req.teamId, req.user.id, deliveryId);
  }

  @Post('alert-events/:eventId/acknowledge')
  async acknowledgeEvent(
    @Request() req: AuthRequest,
    @Param('eventId') eventId: string,
  ) {
    const scope = await this.monitoringService.getEventAccessScope(req.teamId, eventId);
    await this.assertCanWriteMonitoring(req, 'monitoring.event.acknowledge', eventId, scope.projectId, scope.environmentId, 'low');
    return this.monitoringService.acknowledgeEvent(req.teamId, req.user.id, eventId);
  }

  private assertCanWriteMonitoring(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'monitoring',
      action,
      targetType: this.monitoringTargetType(action),
      targetId,
      risk,
    });
  }

  private monitoringTargetType(action: string) {
    if (action.startsWith('monitoring.event.')) return 'alert_event';
    if (action.startsWith('monitoring.silence.')) return 'alert_silence';
    if (action.startsWith('monitoring.notification_channel.')) return 'alert_notification_channel';
    if (action.startsWith('monitoring.notification_delivery.')) return 'alert_notification_delivery';
    return 'alert_rule';
  }

  private async filterReadableMonitoringRecords<T extends ReadableMonitoringRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => ({
      record,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: record.projectId ?? record.rule?.projectId ?? record.channel?.projectId ?? record.alertEvent?.projectId ?? null,
        environmentId: record.environmentId ??
          record.rule?.environmentId ??
          record.channel?.environmentId ??
          record.alertEvent?.environmentId ??
          null,
        category: 'monitoring',
        action,
        targetType,
        targetId: record.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }
}
