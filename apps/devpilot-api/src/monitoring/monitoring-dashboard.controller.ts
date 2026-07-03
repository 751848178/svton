import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ListResourceMetricDashboardQueryDto,
  ListServiceSloDashboardQueryDto,
} from "./dto/monitoring.dto";
import { MonitoringAccessService } from "./monitoring-access.service";
import type { MonitoringAuthRequest } from "./monitoring-access.types";
import { MonitoringService } from "./monitoring.service";

@Controller("monitoring")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class MonitoringDashboardController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly monitoringAccess: MonitoringAccessService,
  ) {}

  @Get("resource-metrics/dashboard")
  async getResourceMetricDashboard(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListResourceMetricDashboardQueryDto,
  ) {
    const dashboard =
      await this.monitoringService.listResourceMetricDashboardRows(
        req.teamId,
        query,
      );
    const readableRows =
      await this.monitoringAccess.filterReadableMonitoringRecords(
        req,
        dashboard.rows,
        "monitoring.resource_metric_dashboard.read",
        "resource_metric_dashboard",
      );
    return this.monitoringService.summarizeResourceMetricDashboard(
      readableRows,
      dashboard.windowMinutes,
      dashboard.staleAfterMinutes,
      dashboard.generatedAt,
    );
  }

  @Get("service-slo/templates")
  listServiceSloRuleTemplates() {
    return this.monitoringService.listServiceSloRuleTemplates();
  }

  @Get("service-slo/dashboard")
  async getServiceSloDashboard(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListServiceSloDashboardQueryDto,
  ) {
    const dashboard = await this.monitoringService.listServiceSloDashboardRows(
      req.teamId,
      query,
    );
    const readableRows =
      await this.monitoringAccess.filterReadableMonitoringRecords(
        req,
        dashboard.rows,
        "monitoring.service_slo_dashboard.read",
        "service_slo_dashboard",
      );
    return this.monitoringService.summarizeServiceSloDashboard(
      readableRows,
      dashboard.windowMinutes,
      dashboard.targetPercent,
      dashboard.generatedAt,
    );
  }
}
