import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";

const SOURCE_TTL_MS = 24 * 60 * 60 * 1000;

export function evaluateReleaseMergeState(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const evidence = context.decisionTarget?.sourceEvidence;
  if (!evidence || evidence.status === "unavailable" || !evidence.evidenceRef) {
    return unavailable(
      evidence?.reasonCode ?? "source_state_evidence_missing",
      "缺少精确 Commit、默认 HEAD、基线与合并树的真实 Git 证据",
      "Real Git evidence for the exact Commit, default HEAD, baseline, and merge tree is missing",
    );
  }
  const checkedAt = evidence.checkedAt ? new Date(evidence.checkedAt) : now;
  const blocked =
    evidence.status === "blocked" ||
    evidence.defaultHead !== evidence.exactCommit ||
    (evidence.behind ?? 0) > 0 ||
    evidence.mergeTreeClean !== true;
  return evaluated({
    status: blocked ? "blocked" : "checked",
    reasonCode: blocked ? "source_merge_state_blocked" : "source_merge_state_verified",
    zh: blocked
      ? "精确 Commit 已落后默认 HEAD，或基线合并树存在冲突"
      : `真实 Git 检查通过：ahead ${evidence.ahead ?? 0} / behind ${evidence.behind ?? 0}`,
    en: blocked
      ? "The exact Commit is behind default HEAD or conflicts with the baseline merge tree"
      : `Real Git inspection passed: ahead ${evidence.ahead ?? 0} / behind ${evidence.behind ?? 0}`,
    evidenceRef: evidence.evidenceRef,
    checkedAt,
    ttlMs: SOURCE_TTL_MS,
    now,
  });
}

export function evaluateReleaseRequiredChecks(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const evidence = context.decisionTarget?.sourceEvidence;
  const policy = evidence?.sourcePolicyRevision;
  if (!evidence || evidence.status === "unavailable" || !evidence.evidenceRef || !policy) {
    return unavailable(
      "source_policy_revision_missing",
      "缺少冻结的 SourcePolicyRevision",
      "A frozen SourcePolicyRevision is missing",
    );
  }
  const current = context.project.currentSourcePolicyRevision;
  if (
    !current ||
    current.id !== policy.id ||
    current.snapshotHash !== policy.snapshotHash
  ) {
    return unavailable(
      "source_policy_revision_stale",
      "SourcePolicyRevision 已变化，必须基于当前策略重新检查",
      "SourcePolicyRevision changed; the source must be checked again against the current policy",
    );
  }
  if (
    !evidence.exactCommit ||
    evidence.exactCommit !== context.decisionTarget?.sourceCommitSha
  ) {
    return unavailable(
      "source_policy_commit_stale",
      "SourcePolicyRevision 证据未绑定当前精确 Commit",
      "SourcePolicyRevision evidence is not bound to the current exact Commit",
    );
  }
  if (policy.externalRequiredChecks > 0) {
    return unavailable(
      "required_checks_commit_receipt_missing",
      "策略要求外部 CI，但缺少绑定当前 Commit 的回执",
      "The policy requires external CI, but no receipt is bound to the current Commit",
    );
  }
  if (!evidence.commitAuthorUserId) {
    return unavailable(
      "commit_author_subject_unmapped",
      "当前 Commit 作者无法映射到团队身份，不能确认独立审批",
      "The current Commit author cannot be mapped to a team identity for independent approval",
    );
  }
  if (policy.requiredIndependentApprovals < 1) {
    return unavailable(
      "independent_approval_policy_invalid",
      "本地验收策略未要求独立代码审批，不能放行",
      "The local acceptance policy does not require an independent code approval",
    );
  }
  const checkedAt = evidence.checkedAt ? new Date(evidence.checkedAt) : now;
  return evaluated({
    status: "manual",
    reasonCode: "independent_code_approval_required",
    zh: "外部 CI 要求为 0；仍需一名独立人员确认当前 Commit",
    en: "External CI requirement is zero; one independent reviewer must still approve this Commit",
    evidenceRef: evidence.evidenceRef,
    checkedAt,
    ttlMs: SOURCE_TTL_MS,
    now,
    evidenceIdentity: {
      sourcePolicyRevisionId: policy.id,
      sourcePolicySnapshotHash: policy.snapshotHash,
      sourceCommitSha: evidence.exactCommit ?? "",
      commitAuthorUserId: evidence.commitAuthorUserId,
      profileId: policy.profileId,
      profileVersion: policy.profileVersion,
    },
  });
}

export function evaluateReleaseHighRiskPaths(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const evidence = context.decisionTarget?.sourceEvidence;
  if (!evidence || evidence.status === "unavailable" || !evidence.evidenceRef || !evidence.changedPaths) {
    return unavailable(
      "baseline_diff_evidence_missing",
      "缺少绑定当前 Commit 的真实基线差异证据",
      "Real baseline-diff evidence bound to the current Commit is missing",
    );
  }
  const highRisk = evidence.highRiskPaths ?? [];
  const checkedAt = evidence.checkedAt ? new Date(evidence.checkedAt) : now;
  return evaluated({
    status: highRisk.length ? "manual" : "checked",
    reasonCode: highRisk.length ? "high_risk_changes_need_review" : "no_high_risk_changes",
    zh: highRisk.length
      ? `真实基线差异命中 ${highRisk.length} 个高风险路径，需要人工复核`
      : `真实基线差异共 ${evidence.changedPaths.length} 个文件，未命中高风险路径`,
    en: highRisk.length
      ? `${highRisk.length} high-risk path(s) in the real baseline diff require review`
      : `${evidence.changedPaths.length} changed file(s) did not match a high-risk path`,
    evidenceRef: evidence.evidenceRef,
    checkedAt,
    ttlMs: SOURCE_TTL_MS,
    now,
  });
}
