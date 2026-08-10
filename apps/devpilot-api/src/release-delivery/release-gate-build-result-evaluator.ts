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
    evidenceRef: `build-run:${build.id}#${key}`,
    checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
    now,
  });
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
