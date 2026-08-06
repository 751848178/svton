import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { RepositoryAnalysisModule } from "../repository-analysis/repository-analysis.module";
import { RepositoryIdentityModule } from "../repository-identity/repository-identity.module";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import { releaseDeploymentProviders } from "./release-deployment.providers";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseBuildCancellationController } from "./release-build-cancellation.controller";
import { ReleaseBuildDetailController } from "./release-build-detail.controller";
import { ReleaseBuildCancellationService } from "./release-build-cancellation.service";
import { ReleaseBuildRecoveryService } from "./release-build-recovery.service";
import { ReleaseBuildRecoveryRepository } from "./release-build-recovery.repository";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildRunnerService } from "./release-build-runner.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { ReleaseBuildExecutorPort } from "./release-build.types";
import { ReleaseStagingRepository } from "./release-staging.repository";
import { ReleaseStagingService } from "./release-staging.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { ReleaseStagingWorkloadStateRepository } from "./release-staging-workload-state.repository";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseProductionService } from "./release-production.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderController } from "./release-order.controller";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { ReleaseOrderEvidenceController } from "./release-order-evidence.controller";
import { ReleaseOrderEvidenceRepository } from "./release-order-evidence.repository";
import { ReleaseOrderEvidenceService } from "./release-order-evidence.service";
import { ReleaseOrderRepository } from "./release-order.repository";
import { ReleaseOrderService } from "./release-order.service";
import { ReleaseOrderWithdrawController } from "./release-order-withdraw.controller";
import { ReleaseOrderWithdrawRepository } from "./release-order-withdraw.repository";
import { ReleaseOrderWithdrawService } from "./release-order-withdraw.service";
import { ReleaseOrderListRepository } from "./release-order-list.repository";
import { ReleaseOrderListService } from "./release-order-list.service";
import { EnvironmentVersionController } from "./environment-version.controller";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateArtifactCapabilityProvider } from "./release-gate-artifact-capability.provider";
import { ReleaseGateBuildCapabilityProvider } from "./release-gate-build-capability.provider";
import { ReleaseGateCatalogController } from "./release-gate-catalog.controller";
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";
import { ReleaseGateEvidenceRepository } from "./release-gate-evidence.repository";
import { ReleaseGateDeployEvidenceRepository } from "./release-gate-deploy-evidence.repository";
import { ReleaseGateDeployOperationEvidenceRepository } from "./release-gate-deploy-operation-evidence.repository";
import { ReleaseGateDeployResourceEvidenceRepository } from "./release-gate-deploy-resource-evidence.repository";
import { ReleaseGatePromoteEvidenceRepository } from "./release-gate-promote-evidence.repository";
import { ReleaseGateSourceCapabilityProvider } from "./release-gate-source-capability.provider";
import { ReleaseGateConfigCapabilityProvider } from "./release-gate-config-capability.provider";
import { ReleaseGateMigrationCapabilityProvider } from "./release-gate-migration-capability.provider";
import { ReleaseGateRuntimeCapabilityProvider } from "./release-gate-runtime-capability.provider";
import { ReleaseGateApprovalCapabilityProvider } from "./release-gate-approval-capability.provider";
import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { ReleaseGatePromotionCapabilityProvider } from "./release-gate-promotion-capability.provider";
import { ReleaseGateRecoveryStrategyProvider } from "./release-gate-recovery-strategy.provider";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import { ReleasePolicyController } from "./release-policy.controller";
import { ReleasePolicyRepository } from "./release-policy.repository";
import { ReleasePolicyService } from "./release-policy.service";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";
import { ReleaseDeliveryCompatibilityController } from "./release-delivery-compatibility.controller";
import { ReleaseDeliveryCompatibilityRepository } from "./release-delivery-compatibility.repository";
import { ReleaseDeliveryCompatibilityService } from "./release-delivery-compatibility.service";
import { GateEvaluationRepository } from "./gate-evaluation.repository";
import { ReleaseGateDecisionRepository } from "./release-gate-decision.repository";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { ReleaseGateEvaluationService } from "./release-gate-evaluation.service";
import { ReleaseGateManualConfirmationService } from "./release-gate-manual-confirmation.service";
import { ProjectDeliverySummaryController } from "./project-delivery-summary.controller";
import { ProjectDeliverySummaryRepository } from "./project-delivery-summary.repository";
import { ProjectDeliverySummaryService } from "./project-delivery-summary.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteFinalProbeService } from "../site/site-final-probe.service";
import {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";

@Module({
  imports: [
    PrismaModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
    RepositoryIdentityModule,
  ],
  controllers: [
    ReleaseOrderController,
    ReleaseOrderEvidenceController,
    ReleaseBuildCancellationController,
    ReleaseBuildDetailController,
    ReleaseOrderWithdrawController,
    EnvironmentVersionController,
    ReleaseGateCatalogController,
    ReleasePolicyController,
    ReleaseDeliveryCompatibilityController,
    ProjectDeliverySummaryController,
  ],
  providers: [
    ReleaseOrderService,
    ReleaseOrderRepository,
    ReleaseOrderDetailRepository,
    ReleaseOrderEvidenceRepository,
    ReleaseOrderEvidenceService,
    ReleaseOrderWithdrawRepository,
    ReleaseOrderWithdrawService,
    ReleaseOrderListRepository,
    ReleaseOrderListService,
    ReleaseOrderAccessService,
    ReleaseBuildArtifactService,
    ReleaseBuildCancellationService,
    ReleaseBuildRecoveryRepository,
    ReleaseBuildRecoveryService,
    ReleaseBuildRunnerService,
    ReleaseBuildRuntimeProfileService,
    ReleaseBuildRuntimeSupervisorService,
    LocalReleaseBuildExecutorService,
    LocalReleaseStagingExecutorService,
    ...releaseDeploymentProviders,
    ReleaseBuildRepository,
    ReleaseBuildResultRepository,
    ReleaseBuildService,
    ReleaseBuildSourceResolverService,
    ReleaseStagingRepository,
    ReleaseStagingService,
    ReleaseStagingWorkloadService,
    ReleaseStagingWorkloadStateRepository,
    ReleaseProductionWorkloadService,
    ReleaseProductionRepository,
    ReleaseProductionService,
    ReleasePolicyRepository,
    ReleasePolicyService,
    ReleaseStrategyCapabilityService,
    ReleaseDeliveryCompatibilityRepository,
    ReleaseDeliveryCompatibilityService,
    EnvironmentVersionRepository,
    EnvironmentVersionService,
    EnvironmentVersionReadRepository,
    EnvironmentVersionPolicyService,
    EnvironmentVersionProductionGateService,
    EnvironmentVersionGateEvidenceRepository,
    ReleaseGateCapabilityRegistryService,
    ReleaseGateArtifactCapabilityProvider,
    ReleaseGateSourceCapabilityProvider,
    ReleaseGateBuildCapabilityProvider,
    ReleaseGateConfigCapabilityProvider,
    ReleaseGateRuntimeCapabilityProvider,
    ReleaseGateMigrationCapabilityProvider,
    ReleaseGateApprovalCapabilityProvider,
    ReleaseGateIngressCapabilityProvider,
    ReleaseGatePromotionCapabilityProvider,
    ReleaseGateObservabilityCapabilityProvider,
    ReleaseGateRecoveryStrategyProvider,
    ReleaseGateEvidenceRepository,
    ReleaseGateDeployEvidenceRepository,
    ReleaseGateDeployOperationEvidenceRepository,
    ReleaseGateDeployResourceEvidenceRepository,
    ReleaseGatePromoteEvidenceRepository,
    ReleaseGateCatalogService,
    GateEvaluationRepository,
    ReleaseGateDecisionRepository,
    ReleaseGateDecisionService,
    ReleaseGateEvaluationService,
    ReleaseGateManualConfirmationService,
    ProjectDeliverySummaryRepository,
    ProjectDeliverySummaryService,
    SiteRouteActivationService,
    SiteFinalProbeService,
    {
      provide: ReleaseBuildExecutorPort,
      useExisting: LocalReleaseBuildExecutorService,
    },
    {
      provide: ReleaseStagingExecutorPort,
      useExisting: LocalReleaseStagingExecutorService,
    },
    {
      provide: SiteRouteActivationPort,
      useExisting: SiteRouteActivationService,
    },
    {
      provide: SiteProbePort,
      useExisting: SiteFinalProbeService,
    },
  ],
  exports: [
    ReleaseOrderService,
    ReleaseBuildService,
    ReleaseStagingService,
    ReleaseProductionService,
  ],
})
export class ReleaseDeliveryModule {}
