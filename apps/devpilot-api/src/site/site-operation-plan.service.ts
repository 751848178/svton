import {
  CreateSiteDiagnosticsDto,
  CreateSiteOpenRestyModuleBaselineDto,
  CreateSiteOpenRestyModulesDto,
  CreateSiteOpenRestyStatusDto,
  CreateSiteSmokeCheckDto,
  CreateSiteSyncPlanDto,
} from "./dto/site.dto";
import {
  buildOpenRestyModuleBaselinePlan,
  buildOpenRestyModulesPlan,
  buildOpenRestyStatusPlan,
} from "./site-openresty-plan.utils";
import { buildSmokeCheckPlan } from "./site-ops-plan.utils";
import { SiteOperationTrigger } from "./site-plan.types";
import { SiteCrudService } from "./site-crud.service";
import { SiteSyncExecutionService } from "./site-sync-execution.service";
import { buildDiagnosticsPlan, buildSyncPlan } from "./site-sync-plan.utils";

export class SiteOperationPlanService {
  constructor(
    private readonly siteCrudService: SiteCrudService,
    private readonly executionService: SiteSyncExecutionService,
  ) {}

  async createSyncPlan(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteSyncPlanDto,
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildSyncPlan(site),
      {
        action: "site.sync",
        operationKey: "site.sync",
        mode: "sync",
        trigger: "manual",
        dryRun: dto.dryRun !== false,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
        confirmationText: dto.confirmationText,
        approvalId: dto.approvalId,
        approvalReason: dto.approvalReason,
      },
    );
  }

  async createDiagnostics(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteDiagnosticsDto,
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildDiagnosticsPlan(site, dto.tailLines),
      {
        action: "site.diagnostics",
        operationKey: "site.diagnostics",
        mode: "diagnostics",
        trigger: "manual_diagnostics",
        dryRun: dto.dryRun === true,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
      },
    );
  }

  createOpenRestyStatus(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteOpenRestyStatusDto,
  ) {
    return this.executeOpenResty(
      teamId,
      userId,
      id,
      dto,
      "site.openresty_status",
      "openresty_status",
      "manual_openresty_status",
      buildOpenRestyStatusPlan,
    );
  }

  createOpenRestyModules(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteOpenRestyModulesDto,
  ) {
    return this.executeOpenResty(
      teamId,
      userId,
      id,
      dto,
      "site.openresty_modules",
      "openresty_modules",
      "manual_openresty_modules",
      buildOpenRestyModulesPlan,
    );
  }

  createOpenRestyModuleBaseline(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteOpenRestyModuleBaselineDto,
  ) {
    return this.executeOpenResty(
      teamId,
      userId,
      id,
      dto,
      "site.openresty_module_baseline",
      "openresty_module_baseline",
      "manual_openresty_module_baseline",
      buildOpenRestyModuleBaselinePlan,
    );
  }

  async createSmokeCheck(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteSmokeCheckDto,
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildSmokeCheckPlan(site),
      {
        action: "site.smoke_check",
        operationKey: "site.smoke_check",
        mode: "smoke_check",
        trigger: "manual_smoke_check",
        dryRun: dto.dryRun === true,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
      },
    );
  }

  private async executeOpenResty(
    teamId: string,
    userId: string,
    id: string,
    dto: { dryRun?: boolean; queue?: boolean; maxAttempts?: number },
    action:
      | "site.openresty_status"
      | "site.openresty_modules"
      | "site.openresty_module_baseline",
    mode:
      | "openresty_status"
      | "openresty_modules"
      | "openresty_module_baseline",
    trigger: SiteOperationTrigger,
    buildPlan: (
      site: Awaited<ReturnType<SiteCrudService["getSite"]>>,
    ) => ReturnType<typeof buildOpenRestyStatusPlan>,
  ) {
    const site = await this.siteCrudService.getSite(teamId, id);
    return this.executionService.execute(
      teamId,
      userId,
      site,
      buildPlan(site),
      {
        action,
        operationKey: action,
        mode,
        trigger,
        dryRun: dto.dryRun === true,
        queue: dto.queue,
        maxAttempts: dto.maxAttempts,
      },
    );
  }
}
