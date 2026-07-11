import { Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import { OperationApprovalAuditRecord } from "./operation-approval.types";

@Injectable()
export class OperationApprovalAuditService {
  constructor(private readonly auditEventService: AuditEventService) {}

  async writeApprovalAudit(
    approval: OperationApprovalAuditRecord,
    action: string,
    status: string,
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
    });
  }
}
