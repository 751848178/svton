import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateSiteTlsProbeDto,
  CreateSiteTlsRenewDto,
  RollbackSiteSyncRunDto,
} from "./dto/site.dto";
import { SYNC_RUN_INCLUDE } from "./site-includes.utils";
import { buildTlsProbePlan, buildTlsRenewPlan } from "./site-ops-plan.utils";
import { SiteOperationTrigger } from "./site-plan.types";
import { SiteCrudService } from "./site-crud.service";
import {
  SiteOperationExecutionResult,
  SiteSyncExecutionService,
} from "./site-sync-execution.service";
import { buildRollbackPlan } from "./site-sync-plan.utils";

export class SiteTlsRollbackOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteCrudService: SiteCrudService,
    private readonly executionService: SiteSyncExecutionService,
  ) {}

  async createTlsProbe(
    teamId: string,
    userId: string | null,
    id: string,
    dto: CreateSiteTlsProbeDto,
    trigger: SiteOperationTrigger = "manual_tls_probe",
    sourceRunId?: string | null,
  ): Promise<SiteOperationExecutionResult> {
    const site = await this.siteCrudService.getSite(teamId, id);
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildTlsProbePlan(site),
      {
        action: "site.tls_probe",
        operationKey: "site.tls_probe",
        mode: "tls_probe",
        trigger,
        dryRun: dto.dryRun === true,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
        sourceRunId,
      },
    );
  }

  async createTlsRenew(
    teamId: string,
    userId: string | null,
    id: string,
    dto: CreateSiteTlsRenewDto,
    trigger: SiteOperationTrigger = "manual_tls_renew",
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    const dryRun = dto.dryRun !== false;
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildTlsRenewPlan(site, dryRun),
      {
        action: "site.tls_renew",
        operationKey: "site.tls_renew",
        mode: "tls_renew",
        trigger,
        dryRun,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
        confirmationText: dto.confirmationText,
        approvalId: dto.approvalId,
        approvalReason: dto.approvalReason,
      },
    );
  }

  async rollbackSyncRun(
    teamId: string,
    userId: string,
    id: string,
    runId: string,
    dto: RollbackSiteSyncRunDto,
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    const sourceRun = await this.prisma.siteSyncRun.findFirst({
      where: { id: runId, teamId, siteId: id },
      include: SYNC_RUN_INCLUDE,
    });
    if (!sourceRun) throw new NotFoundException("站点同步运行记录不存在");
    if (sourceRun.status !== "completed" || sourceRun.dryRun) {
      throw new BadRequestException(
        "只能回滚到已成功执行的非 dry-run 同步记录",
      );
    }
    if (!sourceRun.nginxConfig.trim()) {
      throw new BadRequestException(
        "历史同步记录缺少 Nginx 配置快照，无法回滚",
      );
    }

    const dryRun = dto.dryRun !== false;
    const plan = buildRollbackPlan(
      site,
      sourceRun.nginxConfig,
      sourceRun.targetConfigPath,
    );
    return this.executionService.execute(teamId, userId, site, plan, {
      action: "site.rollback",
      operationKey: "site.rollback",
      mode: "rollback",
      trigger: "manual_rollback",
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
      approvalId: dto.approvalId,
      approvalReason: dto.approvalReason,
      sourceRunId: sourceRun.id,
      sourceRun,
    });
  }
}
