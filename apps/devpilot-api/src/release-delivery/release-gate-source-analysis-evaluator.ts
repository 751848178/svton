import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluateReleaseGateAnalysis(
  id: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const analysis = context.project.repositoryAnalysisRuns[0];
  if (!analysis) {
    return unavailable(
      "analysis_missing",
      "尚无 Commit 绑定的仓库分析证据",
      "No Commit-bound repository analysis evidence exists",
    );
  }
  const checkedAt = analysis.finishedAt ?? analysis.createdAt;
  const reference = `repository-analysis:${analysis.id}`;
  if (analysis.status !== "succeeded") {
    return evaluated({
      status: "blocked",
      reasonCode: analysis.errorCode ?? "analysis_failed",
      zh: "仓库分析未成功",
      en: "Repository analysis did not succeed",
      evidenceRef: reference,
      checkedAt,
      ttlMs: ANALYSIS_TTL_MS,
      now,
    });
  }
  const sourceCommitSha =
    context.decisionTarget?.sourceCommitSha ??
    context.buildRuns[0]?.sourceCommitSha;
  if (sourceCommitSha && sourceCommitSha !== analysis.commitSha) {
    return evaluated({
      status: "unchecked",
      reasonCode: "analysis_commit_mismatch",
      zh: "仓库分析未绑定当前 BuildRun 的 Commit",
      en: "Repository analysis is not bound to the current BuildRun Commit",
      evidenceRef: reference,
      checkedAt,
      ttlMs: ANALYSIS_TTL_MS,
      now,
    });
  }
  const result = record(analysis.result);
  if (id === "C05") return componentScope(result, reference, checkedAt, now);
  return changeImpact(result, reference, checkedAt, now);
}

function componentScope(
  result: Record<string, unknown>,
  evidenceRef: string,
  checkedAt: Date,
  now: Date,
) {
  const repository = record(result.repository);
  const services = Array.isArray(result.services) ? result.services.length : 0;
  return evaluated({
    status: services > 0 ? "checked" : "unchecked",
    reasonCode:
      services > 0 ? "component_scope_identified" : "component_scope_empty",
    zh:
      services > 0
        ? `精确 Commit 分析识别 ${services} 个组件（Monorepo：${repository.monorepo === true ? "是" : "否"}）`
        : "分析未识别可交付组件",
    en:
      services > 0
        ? `Exact-Commit analysis identified ${services} component(s) (monorepo: ${repository.monorepo === true ? "yes" : "no"})`
        : "Analysis did not identify any deliverable component",
    evidenceRef,
    checkedAt,
    ttlMs: ANALYSIS_TTL_MS,
    now,
  });
}

function changeImpact(
  result: Record<string, unknown>,
  evidenceRef: string,
  checkedAt: Date,
  now: Date,
) {
  const impact = record(result.changeImpact);
  const directories = Array.isArray(impact.highRiskDirectories)
    ? impact.highRiskDirectories
    : null;
  if (!directories) {
    return unavailable(
      "change_diff_provider_missing",
      "仓库拓扑已分析，但未连接基线差异和高风险目录 Provider",
      "Repository topology was analyzed, but no baseline diff or high-risk directory provider is connected",
    );
  }
  return evaluated({
    status: directories.length ? "manual" : "checked",
    reasonCode: directories.length
      ? "high_risk_changes_need_review"
      : "no_high_risk_changes",
    zh: directories.length
      ? `检测到 ${directories.length} 个高风险目录，需要人工复核`
      : "未检测到高风险目录变更",
    en: directories.length
      ? `${directories.length} high-risk directorie(s) require review`
      : "No high-risk directory changes were detected",
    evidenceRef,
    checkedAt,
    ttlMs: ANALYSIS_TTL_MS,
    now,
  });
}
