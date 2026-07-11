import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { OperationApprovalController } from "./operation-approval.controller";
import { OperationApprovalAuditService } from "./operation-approval-audit.service";
import { OperationApprovalMatchService } from "./operation-approval-match.service";
import { OperationApprovalRequirementRepository } from "./operation-approval-requirement.repository";
import { OperationApprovalRequirementService } from "./operation-approval-requirement.service";
import { OperationApprovalRepository } from "./operation-approval.repository";
import { OperationApprovalService } from "./operation-approval.service";

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [OperationApprovalController],
  providers: [
    OperationApprovalService,
    OperationApprovalRepository,
    OperationApprovalMatchService,
    OperationApprovalAuditService,
    OperationApprovalRequirementRepository,
    OperationApprovalRequirementService,
  ],
  exports: [OperationApprovalService],
})
export class OperationApprovalModule {}
