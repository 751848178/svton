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
import { CloudProviderInventoryService } from './inventory/cloud-provider-inventory.service';
import { ResourceControlSchedulerService } from './resource-control-scheduler.service';
import { ResourceControlController } from './resource-control.controller';
import { ResourceControlService } from './resource-control.service';

@Module({
  imports: [ServerExecutorModule, AuditEventModule, OperationApprovalModule, ControlAccessPolicyModule],
  controllers: [ResourceControlController],
  providers: [
    ResourceControlService,
    DefaultCredentialResolver,
    DirectDbQueryExecutor,
    ServerScriptExecutor,
    CloudSdkExecutor,
    ResourceExecutorRouter,
    CloudProviderInventoryService,
    ResourceControlSchedulerService,
  ],
  exports: [ResourceControlService],
})
export class ResourceControlModule {}
