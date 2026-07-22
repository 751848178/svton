import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { OperationApprovalModule } from '../operation-approval';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourceRequestModule } from '../resource-request/resource-request.module';
import { ServerExecutorModule } from '../server-executor';
import { DeploymentController } from './deployment.controller';
import { DeploymentAutoRollbackSchedulerService } from './deployment-auto-rollback-scheduler.service';
import { DeploymentPostRollbackSmokeSchedulerService } from './deployment-post-rollback-smoke-scheduler.service';
import { DeploymentService } from './deployment.service';

@Module({
  imports: [PrismaModule, ServerExecutorModule, AuditEventModule, OperationApprovalModule, ControlAccessPolicyModule, ResourceRequestModule],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    DeploymentAutoRollbackSchedulerService,
    DeploymentPostRollbackSmokeSchedulerService,
  ],
  exports: [
    DeploymentService,
    DeploymentAutoRollbackSchedulerService,
    DeploymentPostRollbackSmokeSchedulerService,
  ],
})
export class DeploymentModule {}
