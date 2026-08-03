import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { RepositoryAnalysisModule } from "../repository-analysis/repository-analysis.module";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseBuildExecutorPort } from "./release-build.types";
import { ReleaseStagingRepository } from "./release-staging.repository";
import { ReleaseStagingService } from "./release-staging.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseProductionService } from "./release-production.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderController } from "./release-order.controller";
import { ReleaseOrderRepository } from "./release-order.repository";
import { ReleaseOrderService } from "./release-order.service";
import { EnvironmentVersionController } from "./environment-version.controller";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateCatalogController } from "./release-gate-catalog.controller";
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule, RepositoryAnalysisModule],
  controllers: [
    ReleaseOrderController,
    EnvironmentVersionController,
    ReleaseGateCatalogController,
  ],
  providers: [
    ReleaseOrderService,
    ReleaseOrderRepository,
    ReleaseOrderAccessService,
    ReleaseBuildArtifactService,
    LocalReleaseBuildExecutorService,
    LocalReleaseStagingExecutorService,
    ReleaseBuildRepository,
    ReleaseBuildService,
    ReleaseStagingRepository,
    ReleaseStagingService,
    ReleaseProductionRepository,
    ReleaseProductionService,
    EnvironmentVersionRepository,
    EnvironmentVersionService,
    EnvironmentVersionReadRepository,
    EnvironmentVersionPolicyService,
    ReleaseGateCapabilityRegistryService,
    ReleaseGateCatalogService,
    {
      provide: ReleaseBuildExecutorPort,
      useExisting: LocalReleaseBuildExecutorService,
    },
    {
      provide: ReleaseStagingExecutorPort,
      useExisting: LocalReleaseStagingExecutorService,
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
