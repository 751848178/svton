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
  CreateAlertRuleDto,
  EvaluateAlertRuleDto,
  ListAlertEventsQueryDto,
  ListAlertRulesQueryDto,
  UpdateAlertRuleDto,
} from "./dto/monitoring.dto";
import { MonitoringAccessService } from "./monitoring-access.service";
import type { MonitoringAuthRequest } from "./monitoring-access.types";
import { MonitoringAlertEventService } from "./monitoring-alert-event.service";
import { MonitoringAlertRuleService } from "./monitoring-alert-rule.service";
import { MonitoringService } from "./monitoring.service";

@Controller("monitoring")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly monitoringAccess: MonitoringAccessService,
    private readonly alertRuleService: MonitoringAlertRuleService,
    private readonly alertEventService: MonitoringAlertEventService,
  ) {}

  @Get("alert-rules")
  async listRules(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListAlertRulesQueryDto,
  ) {
    const rules = await this.alertRuleService.listRules(req.teamId, query);
    const readableRules =
      await this.monitoringAccess.filterReadableMonitoringRecords(
        req,
        rules,
        "monitoring.rule.read",
        "alert_rule",
      );
    return Promise.all(
      readableRules.map(async (rule) => ({
        ...rule,
        events: await this.monitoringAccess.filterReadableMonitoringRecords(
          req,
          rule.events ?? [],
          "monitoring.event.read",
          "alert_event",
        ),
      })),
    );
  }

  @Post("alert-rules")
  async createRule(
    @Request() req: MonitoringAuthRequest,
    @Body() dto: CreateAlertRuleDto,
  ) {
    const scope = await this.alertRuleService.resolveCreateAccessScope(
      req.teamId,
      dto,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.rule.create",
      null,
      scope.projectId,
      scope.environmentId,
      "medium",
    );
    return this.alertRuleService.createRule(req.teamId, req.user.id, dto);
  }

  @Put("alert-rules/:ruleId")
  async updateRule(
    @Request() req: MonitoringAuthRequest,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    const scope = await this.alertRuleService.getAccessScope(
      req.teamId,
      ruleId,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.rule.update",
      ruleId,
      scope.projectId,
      scope.environmentId,
      "medium",
    );
    return this.alertRuleService.updateRule(req.teamId, ruleId, dto);
  }

  @Post("alert-rules/:ruleId/evaluate")
  async evaluateRule(
    @Request() req: MonitoringAuthRequest,
    @Param("ruleId") ruleId: string,
    @Body() dto: EvaluateAlertRuleDto,
  ) {
    const scope = await this.alertRuleService.getAccessScope(
      req.teamId,
      ruleId,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.rule.evaluate",
      ruleId,
      scope.projectId,
      scope.environmentId,
      "low",
    );
    return this.monitoringService.evaluateRule(
      req.teamId,
      req.user.id,
      ruleId,
      dto,
    );
  }

  @Get("alert-events")
  async listEvents(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListAlertEventsQueryDto,
  ) {
    const events = await this.alertEventService.listEvents(req.teamId, query);
    return this.monitoringAccess.filterReadableMonitoringRecords(
      req,
      events,
      "monitoring.event.read",
      "alert_event",
    );
  }

  @Post("alert-events/:eventId/acknowledge")
  async acknowledgeEvent(
    @Request() req: MonitoringAuthRequest,
    @Param("eventId") eventId: string,
  ) {
    const scope = await this.alertEventService.getAccessScope(
      req.teamId,
      eventId,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.event.acknowledge",
      eventId,
      scope.projectId,
      scope.environmentId,
      "low",
    );
    return this.alertEventService.acknowledgeEvent(
      req.teamId,
      req.user.id,
      eventId,
    );
  }
}
