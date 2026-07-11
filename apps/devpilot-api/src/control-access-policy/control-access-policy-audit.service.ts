import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { AuditEventService } from "../audit-event";
import { PolicyAuditRecord } from "./control-access-policy.types";

@Injectable()
export class ControlAccessPolicyAuditService {
  constructor(
    @Inject(forwardRef(() => AuditEventService))
    private readonly auditEventService: AuditEventService,
  ) {}

  writePolicyAudit(
    policy: PolicyAuditRecord,
    actorId: string,
    action: string,
    status: string,
  ) {
    return this.auditEventService.create({
      teamId: policy.teamId,
      actorId,
      projectId: policy.projectId,
      environmentId: policy.environmentId,
      category: "access_policy",
      action,
      targetType: "control_access_policy",
      targetId: policy.id,
      risk: "medium",
      status,
      summary: `控制面访问策略「${policy.name}」已变更`,
      metadata: {
        effect: policy.effect,
        principalType: policy.principalType,
        principalRole: policy.principalRole,
        principalUserId: policy.principalUserId,
      },
    });
  }
}
