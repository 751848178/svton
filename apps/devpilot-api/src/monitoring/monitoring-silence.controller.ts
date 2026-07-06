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
  CreateAlertSilenceDto,
  ListAlertSilencesQueryDto,
  UpdateAlertSilenceDto,
} from "./dto/monitoring.dto";
import { MonitoringAccessService } from "./monitoring-access.service";
import type { MonitoringAuthRequest } from "./monitoring-access.types";
import { MonitoringAlertSilenceService } from "./monitoring-alert-silence.service";

@Controller("monitoring")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class MonitoringSilenceController {
  constructor(
    private readonly monitoringAccess: MonitoringAccessService,
    private readonly alertSilenceService: MonitoringAlertSilenceService,
  ) {}

  @Get("silences")
  async listSilences(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListAlertSilencesQueryDto,
  ) {
    const silences = await this.alertSilenceService.listSilences(
      req.teamId,
      query,
    );
    return this.monitoringAccess.filterReadableMonitoringRecords(
      req,
      silences,
      "monitoring.silence.read",
      "alert_silence",
    );
  }

  @Post("silences")
  async createSilence(
    @Request() req: MonitoringAuthRequest,
    @Body() dto: CreateAlertSilenceDto,
  ) {
    const scope = await this.alertSilenceService.resolveScope(req.teamId, dto);
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.silence.create",
      null,
      scope.projectId,
      scope.environmentId,
      "medium",
    );
    return this.alertSilenceService.createSilence(req.teamId, req.user.id, dto);
  }

  @Put("silences/:silenceId")
  async updateSilence(
    @Request() req: MonitoringAuthRequest,
    @Param("silenceId") silenceId: string,
    @Body() dto: UpdateAlertSilenceDto,
  ) {
    const currentScope = await this.alertSilenceService.getAccessScope(
      req.teamId,
      silenceId,
    );
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.alertSilenceService.resolveScope(
        req.teamId,
        dto,
      );
      await this.monitoringAccess.assertCanWriteMonitoring(
        req,
        "monitoring.silence.update",
        silenceId,
        targetScope.projectId,
        targetScope.environmentId,
        "medium",
      );
    }
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.silence.update",
      silenceId,
      currentScope.projectId,
      currentScope.environmentId,
      "medium",
    );
    return this.alertSilenceService.updateSilence(req.teamId, silenceId, dto);
  }
}
