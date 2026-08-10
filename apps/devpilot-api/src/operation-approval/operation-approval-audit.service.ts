import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditEventService } from "../audit-event";
import { OperationApprovalAuditRecord } from "./operation-approval.types";

@Injectable()
export class OperationApprovalAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  // F470：tx 透传让胜者 decision audit 与 CAS 共享同一交互式事务；审计抛错回滚审批状态。
  async writeApprovalAudit(
    approval: OperationApprovalAuditRecord,
    action: string,
    status: string,
    tx?: Prisma.TransactionClient,
  ) {
    await this.auditEventService.create({
      teamId: approval.teamId,
      actorId: approval.reviewerId || approval.requesterId,
      projectId: approval.projectId,
      environmentId: approval.environmentId,
      applicationId: approval.applicationId,
      applicationServiceId: approval.applicationServiceId,
      serverId: approval.serverId,
      siteId: approval.siteId,
      managedResourceId: approval.managedResourceId,
      operationApprovalId: approval.id,
      category: "operation_approval",
      action,
      targetType: "operation_approval",
      targetId: approval.id,
      risk: approval.risk,
      status,
      summary: approval.summary,
      metadata: {
        requestedCategory: approval.category,
        requestedAction: approval.action,
        requestedTargetType: approval.targetType,
        requestedTargetId: approval.targetId,
        reviewComment: approval.reviewComment,
      },
    }, tx);
  }
}
