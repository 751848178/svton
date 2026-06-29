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
import { ResourceRequestService } from './resource-request.service';

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule, ResourcePoolModule, ServerExecutorModule],
  controllers: [
    ResourceTypeController,
    ResourceRequestsController,
    ResourceInstancesController,
    ResourceAuditLogsController,
  ],
  providers: [ResourceRequestService, ResourceRequestProvisioningRetrySchedulerService],
  exports: [ResourceRequestService, ResourceRequestProvisioningRetrySchedulerService],
})
export class ResourceRequestModule {}
