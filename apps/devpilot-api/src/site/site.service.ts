import { Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import { OperationApprovalService } from "../operation-approval";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorService } from "../server-executor";
import { PreviewSiteTakeoverDto } from "./dto/site.dto";
import { SiteCrudService } from "./site-crud.service";
import { SiteOperationPlanService } from "./site-operation-plan.service";
import { SitePostSyncUpdateService } from "./site-post-sync-update.service";
import { SiteSyncExecutionService } from "./site-sync-execution.service";
import { SiteTlsRollbackOperationService } from "./site-tls-rollback-operation.service";
import {
  buildTakeoverRuntimeConfig,
  validateTakeoverInput,
} from "./site-takeover-preview.utils";

@Injectable()
export class SiteService {
  private readonly crudService: SiteCrudService;
  private readonly operationPlanService: SiteOperationPlanService;
  private readonly tlsRollbackService: SiteTlsRollbackOperationService;

  constructor(
    prisma: PrismaService,
    serverExecutor: ServerExecutorService,
    auditEventService: AuditEventService,
    operationApprovalService: OperationApprovalService,
    postSyncUpdateService: SitePostSyncUpdateService,
  ) {
    this.crudService = new SiteCrudService(prisma);
    const executionService = new SiteSyncExecutionService(
      prisma,
      serverExecutor,
      operationApprovalService,
      postSyncUpdateService,
      auditEventService,
    );
    this.operationPlanService = new SiteOperationPlanService(
      this.crudService,
      executionService,
    );
    this.tlsRollbackService = new SiteTlsRollbackOperationService(
      prisma,
      this.crudService,
      executionService,
    );
    postSyncUpdateService.setCreateTlsProbeCallback((...args) =>
      this.createTlsProbe(...args),
    );
  }

  listSites(...args: Parameters<SiteCrudService["listSites"]>) {
    return this.crudService.listSites(...args);
  }

  createSite(...args: Parameters<SiteCrudService["createSite"]>) {
    return this.crudService.createSite(...args);
  }

  getSite(...args: Parameters<SiteCrudService["getSite"]>) {
    return this.crudService.getSite(...args);
  }

  listSyncRuns(...args: Parameters<SiteCrudService["listSyncRuns"]>) {
    return this.crudService.listSyncRuns(...args);
  }

  updateSite(...args: Parameters<SiteCrudService["updateSite"]>) {
    return this.crudService.updateSite(...args);
  }

  async takeoverPreviewSite(
    teamId: string,
    userId: string,
    id: string,
    dto: PreviewSiteTakeoverDto,
  ) {
    const existing = await this.crudService.getSite(teamId, id);
    const { serverId, upstreamUrl, preview } = validateTakeoverInput(
      dto,
      existing.runtimeConfig,
    );
    await this.crudService.assertBindings(teamId, { serverId });
    const nextRuntimeConfig = buildTakeoverRuntimeConfig(
      existing.runtimeConfig,
      preview,
      upstreamUrl,
      userId,
      dto.websocket,
    );
    const site = await this.crudService.updateTakeoverSite(
      id,
      serverId,
      nextRuntimeConfig,
      dto,
    );
    const syncPlan =
      dto.createDryRunPlan === false
        ? null
        : await this.createSyncPlan(teamId, userId, id, {
            dryRun: true,
            queue: dto.queue,
            maxAttempts: dto.maxAttempts,
          });
    return { site, syncPlan };
  }

  deleteSite(...args: Parameters<SiteCrudService["deleteSite"]>) {
    return this.crudService.deleteSite(...args);
  }

  createSyncPlan(
    ...args: Parameters<SiteOperationPlanService["createSyncPlan"]>
  ) {
    return this.operationPlanService.createSyncPlan(...args);
  }

  createDiagnostics(
    ...args: Parameters<SiteOperationPlanService["createDiagnostics"]>
  ) {
    return this.operationPlanService.createDiagnostics(...args);
  }

  createOpenRestyStatus(
    ...args: Parameters<SiteOperationPlanService["createOpenRestyStatus"]>
  ) {
    return this.operationPlanService.createOpenRestyStatus(...args);
  }

  createOpenRestyModules(
    ...args: Parameters<SiteOperationPlanService["createOpenRestyModules"]>
  ) {
    return this.operationPlanService.createOpenRestyModules(...args);
  }

  createOpenRestyModuleBaseline(
    ...args: Parameters<
      SiteOperationPlanService["createOpenRestyModuleBaseline"]
    >
  ) {
    return this.operationPlanService.createOpenRestyModuleBaseline(...args);
  }

  createSmokeCheck(
    ...args: Parameters<SiteOperationPlanService["createSmokeCheck"]>
  ) {
    return this.operationPlanService.createSmokeCheck(...args);
  }

  createTlsProbe(
    ...args: Parameters<SiteTlsRollbackOperationService["createTlsProbe"]>
  ) {
    return this.tlsRollbackService.createTlsProbe(...args);
  }

  createTlsRenew(
    ...args: Parameters<SiteTlsRollbackOperationService["createTlsRenew"]>
  ) {
    return this.tlsRollbackService.createTlsRenew(...args);
  }

  rollbackSyncRun(
    ...args: Parameters<SiteTlsRollbackOperationService["rollbackSyncRun"]>
  ) {
    return this.tlsRollbackService.rollbackSyncRun(...args);
  }
}
