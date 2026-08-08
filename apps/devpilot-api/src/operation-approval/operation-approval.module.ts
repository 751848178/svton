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
import { OperationApprovalReviewService } from "./operation-approval-review.service";
import { OperationApprovalService } from "./operation-approval.service";

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [OperationApprovalController],
  providers: [
    OperationApprovalService,
    OperationApprovalReviewService,
    OperationApprovalRepository,
    OperationApprovalMatchService,
    OperationApprovalAuditService,
    OperationApprovalRequirementRepository,
    OperationApprovalRequirementService,
  ],
  // OperationApprovalRepository 必须导出：ReleaseOrchestrationModule 的
  // ReleaseApprovalLifecycleService 直接注入它（F383 审批生命周期）。第二轮引入该 service
  // 时遗漏了导出，导致生产 Nest 启动时 DI 无法解析（测试因手工构造 service 未暴露）。
  exports: [OperationApprovalService, OperationApprovalRepository],
})
export class OperationApprovalModule {}
