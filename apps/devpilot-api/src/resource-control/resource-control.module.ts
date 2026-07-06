import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { OperationApprovalModule } from '../operation-approval';
import { ServerExecutorModule } from '../server-executor';
import { DefaultCredentialResolver } from './credentials/credential-resolver';
import { CloudSdkExecutor } from './executors/cloud-sdk.executor';
import { DirectDbQueryExecutor } from './executors/direct-db-query.executor';
import { ResourceExecutorRouter } from './executors/executor-router';
import { ServerScriptExecutor } from './executors/server-script.executor';
import { CliDockerInventoryExecutor } from './inventory/executors/cli-docker-inventory-executor';
import { DockerInventoryExecutorFactory } from './inventory/executors/docker-inventory-executor.factory';
import { CloudProviderInventoryService } from './inventory/cloud-provider-inventory.service';
import { ResourceControlSchedulerService } from './resource-control-scheduler.service';
import { ResourceControlCapabilitiesService } from './resource-control-capabilities.service';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';
import { ResourceControlController } from './resource-control.controller';
import { ResourceControlService } from './resource-control.service';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlListReadService } from './resource-control-list-read.service';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResourceControlConnectionProbeService } from './resource-control-connection-probe.service';
import { ResourceControlResourceQueryService } from './resource-control-query.service';

@Module({
  imports: [ServerExecutorModule, AuditEventModule, OperationApprovalModule, ControlAccessPolicyModule],
  controllers: [ResourceControlController],
  providers: [
    ResourceControlService,
    ResourceControlRepository,
    ResourceControlListReadService,
    ResourceControlBindingService,
    ResourceControlConnectionSharedService,
    ResourceControlConnectionProbeService,
    ResourceControlResourceQueryService,
    ResourceControlCapabilitiesService,
    ResourceControlCloudProviderHealthService,
    DefaultCredentialResolver,
    DirectDbQueryExecutor,
    ServerScriptExecutor,
    CloudSdkExecutor,
    ResourceExecutorRouter,
    CloudProviderInventoryService,
    ResourceControlSchedulerService,
    CliDockerInventoryExecutor,
    DockerInventoryExecutorFactory,
  ],
  exports: [ResourceControlService],
})
export class ResourceControlModule {}
