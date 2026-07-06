import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcePoolModule } from '../resource-pool/resource-pool.module';
import { ServerExecutorModule } from '../server-executor/server-executor.module';
import {
  ResourceAuditLogsController,
  ResourceInstancesController,
  ResourceRequestsController,
  ResourceTypeController,
} from './resource-request.controller';
import { ResourceRequestProvisioningRetrySchedulerService } from './resource-request-provisioning-retry-scheduler.service';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestService } from './resource-request.service';
import { ResourceRequestAccessService } from './resource-request-access.service';
import { ResourceTypeService } from './resource-type.service';
import { ResourceProvisioningRunSupervisorService } from './resource-provisioning-run-supervisor.service';
import { ResourceProvisioningRunReadService } from './resource-provisioning-run-read.service';

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule, ResourcePoolModule, ServerExecutorModule],
  controllers: [
    ResourceTypeController,
    ResourceRequestsController,
    ResourceInstancesController,
    ResourceAuditLogsController,
  ],
  providers: [
    ResourceRequestService,
    ResourceRequestRepository,
    ResourceTypeService,
    ResourceRequestAccessService,
    ResourceRequestProvisioningRetrySchedulerService,
    ResourceProvisioningRunSupervisorService,
    ResourceProvisioningRunReadService,
  ],
  exports: [ResourceRequestService, ResourceRequestProvisioningRetrySchedulerService],
})
export class ResourceRequestModule {}
