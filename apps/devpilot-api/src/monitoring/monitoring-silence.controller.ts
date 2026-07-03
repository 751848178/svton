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
import { MonitoringService } from "./monitoring.service";

@Controller("monitoring")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class MonitoringSilenceController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly monitoringAccess: MonitoringAccessService,
  ) {}

  @Get("silences")
  async listSilences(
    @Request() req: MonitoringAuthRequest,
    @Query() query: ListAlertSilencesQueryDto,
  ) {
    const silences = await this.monitoringService.listSilences(
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
    const scope = await this.monitoringService.resolveSilenceScope(
      req.teamId,
      dto,
    );
    await this.monitoringAccess.assertCanWriteMonitoring(
      req,
      "monitoring.silence.create",
      null,
      scope.projectId,
      scope.environmentId,
      "medium",
    );
    return this.monitoringService.createSilence(req.teamId, req.user.id, dto);
  }

  @Put("silences/:silenceId")
  async updateSilence(
    @Request() req: MonitoringAuthRequest,
    @Param("silenceId") silenceId: string,
    @Body() dto: UpdateAlertSilenceDto,
  ) {
    const currentScope = await this.monitoringService.getSilenceAccessScope(
      req.teamId,
      silenceId,
    );
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.monitoringService.resolveSilenceScope(
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
    return this.monitoringService.updateSilence(req.teamId, silenceId, dto);
  }
}
