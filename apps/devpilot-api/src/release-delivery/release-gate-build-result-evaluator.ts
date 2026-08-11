import type { ReleaseGateStatus } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";

export function evaluateStructuredBuildResult(
  evidence: Record<string, unknown>,
  key: string,
  build: ReleaseGateEvidenceContext["buildRuns"][number],
  now: Date,
) {
  if (Object.keys(evidence).length === 0) {
    return unavailable(
      `${key}_evidence_missing`,
      `BuildRun 未提供 ${key} Provider 证据`,
      `BuildRun did not provide ${key} provider evidence`,
    );
  }
  const evidenceRef =
    typeof evidence.evidenceRef === "string" ? evidence.evidenceRef : "";
  const evidenceHash =
    typeof evidence.evidenceHash === "string" ? evidence.evidenceHash : "";
  const exactPrefix = `release-evidence://${build.id}/`;
  if (
    !evidenceRef ||
    !evidenceHash ||
    evidenceRef.split(";").some((reference) => !reference.startsWith(exactPrefix))
  ) {
    return unavailable(
      `${key}_evidence_identity_invalid`,
      `BuildRun ${key} 证据未绑定当前精确 BuildRun`,
      `BuildRun ${key} evidence is not bound to the exact current BuildRun`,
    );
  }
  const identity = record(evidence.identity);
  if (
    Object.keys(identity).length > 0 &&
    (identity.buildRunId !== build.id ||
      identity.sourceCommitSha !== build.sourceCommitSha ||
      identity.reportDigest === undefined)
  ) {
    return unavailable(
      `${key}_evidence_identity_mismatch`,
      `BuildRun ${key} 证据身份与当前候选不一致`,
      `BuildRun ${key} evidence identity does not match the current candidate`,
    );
  }
  const status = normalizeBuildGateStatus(evidence.status);
  return evaluated({
    status,
    reasonCode: `${key}_${String(evidence.status ?? "unknown")}`,
    zh:
      status === "checked"
        ? `${key} 检查通过`
        : status === "blocked"
          ? `${key} 检查阻断`
          : `${key} 检查未通过门禁`,
    en:
      status === "checked"
        ? `${key} check passed`
        : status === "blocked"
          ? `${key} check blocked`
          : `${key} check did not pass the gate`,
    evidenceRef,
    checkedAt:
      typeof identity.finishedAt === "string"
        ? new Date(identity.finishedAt)
        : build.finishedAt ?? build.startedAt ?? build.createdAt,
    now,
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeBuildGateStatus(value: unknown): ReleaseGateStatus {
  if (value === "passed" || value === "checked" || value === "succeeded") {
    return "checked";
  }
  if (value === "failed" || value === "blocked") return "blocked";
  if (value === "warning") return "warning";
  if (value === "manual" || value === "needs_human") return "manual";
  if (value === "unavailable") return "unavailable";
  return "unchecked";
}
