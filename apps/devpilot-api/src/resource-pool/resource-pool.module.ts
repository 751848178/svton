import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ResourcePoolAccessService } from "./resource-pool-access.service";
import { ResourcePoolAllocationLifecycleService } from "./resource-pool-allocation-lifecycle.service";
import { ResourcePoolProvisioningService } from "./resource-pool-provisioning.service";
import { ResourcePoolRepository } from "./resource-pool.repository";
import { ResourcePoolService } from "./resource-pool.service";
import { ResourcePoolController } from "./resource-pool.controller";

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule],
  controllers: [ResourcePoolController],
  providers: [
    ResourcePoolService,
    ResourcePoolAccessService,
    ResourcePoolAllocationLifecycleService,
    ResourcePoolProvisioningService,
    ResourcePoolRepository,
  ],
  exports: [ResourcePoolService],
})
export class ResourcePoolModule {}
