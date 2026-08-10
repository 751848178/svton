import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

@Injectable()
export class ReleaseGateApprovalCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "production_operation_approval";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M10"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.promote?.releaseRun?.operationApproval);
  }

  evaluate(
    _definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    const run = context.promote?.releaseRun;
    const approval = run?.operationApproval;
    if (!run || !approval) {
      return unavailable(
        "production_approval_missing",
        "当前发布单没有绑定 Production 审批",
        "The current release order has no bound Production approval",
      );
    }
    const scoped = approval.projectId === context.projectId
      && approval.environmentId === run.environmentId;
    const hashBound = approval.inputHash === run.inputHash;
    const protection = record(record(run.policySnapshot).releaseProtection);
    const protectedWindow = protection.changeWindowVerified === true
      && protection.freezeVerified === true;
    const expired = Boolean(approval.expiresAt
      && approval.expiresAt.getTime() < now.getTime());
    const status: ReleaseGateStatus = !scoped || !hashBound || expired
      || approval.status === "rejected" || approval.status === "cancelled"
      ? "blocked" : approval.status === "approved"
        ? protectedWindow ? "checked" : "unchecked"
        : "manual";
    return evaluated({
      status,
      reasonCode: !scoped ? "approval_scope_mismatch"
        : !hashBound ? "approval_input_drift"
          : expired ? "approval_expired"
            : approval.status === "approved" && protectedWindow ? "production_approval_valid"
              : approval.status === "approved" ? "release_protection_incomplete"
              : approval.status === "pending" ? "production_approval_pending" : "production_approval_rejected",
      zh: status === "checked"
        ? "Production 审批、变更窗口和冻结期均绑定冻结输入"
        : status === "unchecked" ? "审批有效，但缺少变更窗口或冻结期 Provider 结论"
          : status === "manual" ? "Production 审批待人工处理" : "审批被拒绝、过期、漂移或归属无效",
      en: status === "checked"
        ? "Production approval, change window, and freeze period are bound to frozen input"
        : status === "unchecked" ? "Approval is valid, but change-window or freeze-period provider conclusion is missing"
          : status === "manual" ? "Production approval requires manual review" : "Approval was rejected, expired, drifted, or has invalid ownership",
      evidenceRef: `operation-approval:${approval.id};release-run:${run.id}`,
      checkedAt: approval.reviewedAt ?? run.createdAt,
      now,
    });
  }
}
