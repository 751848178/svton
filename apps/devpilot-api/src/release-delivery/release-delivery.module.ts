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
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderController } from "./release-order.controller";
import { ReleaseOrderRepository } from "./release-order.repository";
import { ReleaseOrderService } from "./release-order.service";

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule, RepositoryAnalysisModule],
  controllers: [ReleaseOrderController],
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
    {
      provide: ReleaseBuildExecutorPort,
      useExisting: LocalReleaseBuildExecutorService,
    },
    {
      provide: ReleaseStagingExecutorPort,
      useExisting: LocalReleaseStagingExecutorService,
    },
  ],
  exports: [ReleaseOrderService, ReleaseBuildService, ReleaseStagingService],
})
export class ReleaseDeliveryModule {}
