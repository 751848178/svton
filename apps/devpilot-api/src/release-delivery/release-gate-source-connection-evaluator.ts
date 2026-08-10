import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

const SOURCE_TTL_MS = 24 * 60 * 60 * 1000;

export function evaluateReleaseGateSource(
  id: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const connection = context.project.repositoryConnection;
  if (!connection) {
    return unavailable(
      "repository_not_connected",
      "项目尚未连接仓库",
      "The project has no repository connection",
    );
  }
  if (id !== "C01") {
    const mergeState = id === "C02";
    return unavailable(
      mergeState
        ? "merge_state_provider_missing"
        : "required_checks_provider_missing",
      mergeState
        ? "未连接合并、落后和冲突状态 Provider"
        : "未连接必需 CI 和代码审批 Provider",
      mergeState
        ? "No merge, behind, or conflict-state provider is connected"
        : "No required CI and code-review provider is connected",
    );
  }
  const checkedAt = connection.verifiedAt ?? connection.updatedAt;
  const reference = `repository-connection:${connection.id}`;
  if (connection.status === "failed") {
    return evaluated({
      status: "blocked",
      reasonCode: connection.errorCode ?? "repository_verification_failed",
      zh: "仓库连接验证失败",
      en: "Repository connection verification failed",
      evidenceRef: reference,
      checkedAt,
      ttlMs: SOURCE_TTL_MS,
      now,
    });
  }
  if (context.decisionTarget?.sourceResolution === "unavailable") {
    return unavailable(
      "repository_source_resolution_failed",
      "无法解析当前主分支的精确 Commit",
      "The exact Commit for the current default branch could not be resolved",
    );
  }
  if (connection.status !== "connected" || !connection.verifiedAt) {
    return evaluated({
      status: "unchecked",
      reasonCode: "repository_not_verified",
      zh: "仓库连接尚未完成真实验证",
      en: "The repository connection has not been verified",
      evidenceRef: reference,
      checkedAt,
      ttlMs: SOURCE_TTL_MS,
      now,
    });
  }
  const build = context.buildRuns[0];
  const sourceBranch =
    context.decisionTarget?.sourceBranch ?? build?.sourceBranch;
  const sourceCommitSha =
    context.decisionTarget?.sourceCommitSha ?? build?.sourceCommitSha;
  if (!sourceBranch || !sourceCommitSha) {
    return evaluated({
      status: "unchecked",
      reasonCode: "commit_not_locked_by_build",
      zh: "仓库已验证，但发布单尚未由 BuildRun 锁定 Commit",
      en: "The repository is verified, but no BuildRun has locked a Commit",
      evidenceRef: reference,
      checkedAt,
      ttlMs: SOURCE_TTL_MS,
      now,
    });
  }
  const source = record(record(build?.gateSummary).source);
  const expectedBranch = connection.defaultBranch ?? connection.selectedBranch;
  const mismatched = Boolean(expectedBranch && expectedBranch !== sourceBranch);
  const failed = !context.decisionTarget && source.status === "failed";
  const buildReference = build ? `build-run:${build.id}` : reference;
  const buildCheckedAt =
    build?.finishedAt ?? build?.startedAt ?? build?.createdAt ?? checkedAt;
  return evaluated({
    status: mismatched || failed ? "blocked" : "checked",
    reasonCode: mismatched
      ? "default_branch_mismatch"
      : failed
        ? "source_checkout_failed"
        : "exact_commit_resolved",
    zh:
      mismatched || failed
        ? "BuildRun 来源与已验证主分支不一致或精确检出失败"
        : `已解析并锁定 ${sourceBranch}@${sourceCommitSha.slice(0, 12)}`,
    en:
      mismatched || failed
        ? "BuildRun source differs from the verified default branch or exact checkout failed"
        : `Resolved and locked ${sourceBranch}@${sourceCommitSha.slice(0, 12)}`,
    evidenceRef: context.decisionTarget
      ? `${reference};repository-ref:${sourceBranch}@${sourceCommitSha}`
      : `${reference};${buildReference}`,
    checkedAt: context.decisionTarget ? checkedAt : buildCheckedAt,
    ttlMs: SOURCE_TTL_MS,
    now,
  });
}
