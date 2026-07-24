import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { LogCenterModule } from '../log-center/log-center.module';
import { OperationApprovalModule } from '../operation-approval';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourceRequestModule } from '../resource-request/resource-request.module';
import { ServerExecutorModule } from '../server-executor';
import { DeploymentController } from './deployment.controller';
import { DeploymentAutoRollbackSchedulerService } from './deployment-auto-rollback-scheduler.service';
import { DeploymentLogStreamBootstrapService } from './deployment-log-stream-bootstrap.service';
import { DeploymentPostRollbackSmokeSchedulerService } from './deployment-post-rollback-smoke-scheduler.service';
import { DeploymentService } from './deployment.service';

@Module({
  imports: [PrismaModule, ServerExecutorModule, AuditEventModule, OperationApprovalModule, ControlAccessPolicyModule, ResourceRequestModule, LogCenterModule],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    DeploymentLogStreamBootstrapService,
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
