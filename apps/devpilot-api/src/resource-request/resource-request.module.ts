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
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import { ResourceRequestLifecycleService } from './resource-request-lifecycle.service';
import { ResourceRequestInstanceService } from './resource-request-instance.service';
import { ResourceRequestRecoveryService } from './resource-request-recovery.service';
import { ResourceRequestStaleRecoveryService } from './resource-request-stale-recovery.service';
import { ResourceRequestQueueWorker } from './resource-request-queue-worker.service';
import { ResourceProviderStateService } from './resource-provider-state.service';
import { ResourceProviderStateWriterService } from './resource-provider-state-writer.service';
import { ResourceRequestCredentialRefService } from './resource-request-credential-ref.service';
import { ResourceRequestPoolProvisioningService } from './resource-request-pool-provisioning.service';
import { ResourceRequestScriptProvisioningService } from './resource-request-script-provisioning.service';
import { ResourceRequestHttpProvisioningService } from './resource-request-http-provisioning.service';
import { ResourceRequestProviderProvisioningService } from './resource-request-provider-provisioning.service';
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
    ResourceRequestLifecycleService,
    ResourceRequestInstanceService,
    ResourceRequestAccessService,
    ResourceRequestStatusWriterService,
    ResourceProvisioningRunWriterService,
    ResourceRequestProvisioningService,
    ResourceRequestRecoveryService,
    ResourceRequestStaleRecoveryService,
    ResourceRequestQueueWorker,
    ResourceProviderStateService,
    ResourceProviderStateWriterService,
    ResourceRequestCredentialRefService,
    ResourceRequestPoolProvisioningService,
    ResourceRequestScriptProvisioningService,
    ResourceRequestHttpProvisioningService,
    ResourceRequestProviderProvisioningService,
    ResourceRequestProvisioningRetrySchedulerService,
    ResourceProvisioningRunSupervisorService,
    ResourceProvisioningRunReadService,
  ],
  exports: [
    ResourceRequestService,
    ResourceRequestProvisioningRetrySchedulerService,
    ResourceRequestStatusWriterService,
  ],
})
export class ResourceRequestModule {}
