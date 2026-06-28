import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationApprovalController } from './operation-approval.controller';
import { OperationApprovalService } from './operation-approval.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [OperationApprovalController],
  providers: [OperationApprovalService],
  exports: [OperationApprovalService],
})
export class OperationApprovalModule {}
