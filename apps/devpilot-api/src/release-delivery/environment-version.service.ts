import { Injectable } from "@nestjs/common";
import {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import { SiteRouteSwitchPort } from "../site/site-route-switch.port";
import { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { ProductionRouteSagaGuard } from "../site/production-route-saga.guard";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { runEnvironmentDeployment } from "./environment-version-deployment";
import { executeEnvironmentVersion } from "./environment-version-execution";
import type { EnvironmentVersionExecuteInput } from "./environment-version-execution.types";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { currentEnvironmentVersionId } from "./environment-version-read.utils";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseDeploymentTargetReadinessService } from "./release-deployment-target-readiness.service";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { ProductionPromotionAwaitingRepository } from "./production-promotion-awaiting.repository";
import { ProductionPromotionService } from "./production-promotion.service";
import type { ProductionPromotionResumeInput } from "./production-promotion-command.types";
import { presentLegacyPromotionRecovery } from "./production-promotion-legacy-recovery.presenter";

@Injectable()
export class EnvironmentVersionService {
  constructor(
    private readonly repository: EnvironmentVersionRepository,
    private readonly completion: EnvironmentVersionCompletionRepository,
    private readonly readRepository: EnvironmentVersionReadRepository,
    private readonly policy: EnvironmentVersionPolicyService,
    private readonly executor: ReleaseStagingExecutorPort,
    private readonly productionGates: EnvironmentVersionProductionGateService,
    private readonly gateEvidence: EnvironmentVersionGateEvidenceRepository,
    private readonly inputs: ReleaseDeploymentInputService,
    private readonly targetReadiness: ReleaseDeploymentTargetReadinessService,
    private readonly stagingWorkloads: ReleaseStagingWorkloadService,
    private readonly productionWorkloads: ReleaseProductionWorkloadService,
    private readonly routeActivation: SiteRouteActivationPort,
    private readonly routeSwitch: SiteRouteSwitchPort,
    private readonly routeSaga: SiteRouteSwitchSagaOrchestrator,
    private readonly routeSagaGuard: ProductionRouteSagaGuard,
    private readonly siteProbe: SiteProbePort,
    private readonly promotionAwaiting?: ProductionPromotionAwaitingRepository,
    private readonly promotion?: ProductionPromotionService,
  ) {}

  async list(teamId: string, projectId: string) {
    const [environments, candidates] = await Promise.all([
      this.readRepository.environments(teamId, projectId),
      this.readRepository.candidates(teamId, projectId),
    ]);
    const project = { id: projectId, teamId };
    return {
      environments: await Promise.all(
        environments.map(async (environment) => ({
          ...presentEnvironment(environment),
          currentEnvironmentVersionId: currentEnvironmentVersionId(
            project,
            environment,
          ),
          targetReadiness: await this.targetReadiness.get(
            teamId,
            projectId,
            environment.id,
          ),
        })),
      ),
      candidates,
    };
  }

  resumeProductionPromotion(input: ProductionPromotionResumeInput) {
    if (!this.promotion) throw new Error("PRODUCTION_PROMOTION_SERVICE_MISSING");
    return this.promotion.resume(input);
  }

  execute(input: EnvironmentVersionExecuteInput) {
    return executeEnvironmentVersion(
      {
        repository: this.repository,
        policy: this.policy,
        executor: this.executor,
        productionGates: this.productionGates,
        inputs: this.inputs,
        stagingWorkloads: this.stagingWorkloads,
        productionWorkloads: this.productionWorkloads,
        routeSwitch: this.routeSwitch,
        routeSagaGuard: this.routeSagaGuard,
        run: (context) =>
          runEnvironmentDeployment(
            {
              executor: this.executor,
              gateEvidence: this.gateEvidence,
              completion: this.completion,
              productionGates: this.productionGates,
              promotionAwaiting: this.productionAwaiting(),
            },
            context,
          ),
      },
      input,
    );
  }

  private productionAwaiting() {
    if (!this.promotionAwaiting) {
      throw new Error("PRODUCTION_PROMOTION_AWAITING_REPOSITORY_MISSING");
    }
    return this.promotionAwaiting;
  }
}

function presentEnvironment<T extends {
  releaseRuns: Array<{
    productionPromotionCommands: Array<{
      id: string; phase: string; legacyReconcileReason: string | null;
    }>;
  }>;
}>(environment: T) {
  return {
    ...environment,
    releaseRuns: environment.releaseRuns.map((run) => {
      const { productionPromotionCommands, ...value } = run;
      return {
        ...value,
        legacyPromotionRecovery: presentLegacyPromotionRecovery(
          productionPromotionCommands,
        ),
      };
    }),
  };
}
