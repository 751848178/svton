import type { ReleaseGateStatus } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evidenceBuild } from "./release-gate-build-evidence.utils";
import { evaluateStructuredBuildResult } from "./release-gate-build-result-evaluator";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluateBuildQualityGate(
  id: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  if (id === "C08") return evaluateLockfile(context, now);
  const build = evidenceBuild(context);
  if (!build) {
    return unavailable(
      "build_missing",
      "发布单尚无 BuildRun 证据",
      "The release order has no BuildRun evidence",
    );
  }
  const summary = record(build.gateSummary);
  if (id === "B02") return evaluateBuildRun(build, now);
  const key = id === "C09" ? "quality" : id === "B01" ? "install" : "tests";
  return evaluateStructuredBuildResult(record(summary[key]), key, build, now);
}

function evaluateBuildRun(
  build: ReleaseGateEvidenceContext["buildRuns"][number],
  now: Date,
) {
  const status =
    build.status === "succeeded"
      ? "checked"
      : build.status === "failed"
        ? "blocked"
        : "unchecked";
  return evaluated({
    status,
    reasonCode:
      status === "checked"
        ? "build_succeeded"
        : status === "blocked"
          ? (build.errorCode ?? "build_failed")
          : "build_in_progress",
    zh:
      status === "checked"
        ? `Build #${build.revision} 已完成受影响组件编译打包`
        : status === "blocked"
          ? `Build #${build.revision} 构建失败`
          : `Build #${build.revision} 尚未完成`,
    en:
      status === "checked"
        ? `Build #${build.revision} compiled and packaged its components`
        : status === "blocked"
          ? `Build #${build.revision} failed`
          : `Build #${build.revision} is not complete`,
    evidenceRef: `build-run:${build.id}`,
    checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
    now,
  });
}

function evaluateLockfile(context: ReleaseGateEvidenceContext, now: Date) {
  const analysis = context.project.repositoryAnalysisRuns[0];
  if (!analysis || analysis.status !== "succeeded") {
    return unavailable(
      "dependency_analysis_missing",
      "缺少成功的精确 Commit 依赖分析",
      "Successful exact-Commit dependency analysis is missing",
    );
  }
  const sourceCommitSha =
    context.decisionTarget?.sourceCommitSha ??
    evidenceBuild(context)?.sourceCommitSha;
  if (sourceCommitSha && sourceCommitSha !== analysis.commitSha) {
    return unavailable(
      "dependency_analysis_commit_mismatch",
      "依赖分析未绑定当前 BuildRun Commit",
      "Dependency analysis is not bound to the current BuildRun Commit",
    );
  }
  const repository = record(record(analysis.result).repository);
  const manager =
    typeof repository.packageManager === "string"
      ? repository.packageManager
      : null;
  const lockfiles = Array.isArray(repository.lockfiles)
    ? repository.lockfiles.length
    : 0;
  const status: ReleaseGateStatus = manager
    ? lockfiles > 0
      ? "checked"
      : "blocked"
    : "unchecked";
  return evaluated({
    status,
    reasonCode: manager
      ? lockfiles > 0
        ? "dependency_lock_detected"
        : "dependency_lock_missing"
      : "dependency_manager_not_detected",
    zh: manager
      ? lockfiles > 0
        ? `检测到 ${manager} 和 ${lockfiles} 个锁文件`
        : `检测到 ${manager}，但没有锁文件`
      : "未检测到受支持的依赖管理器，未执行一致性检查",
    en: manager
      ? lockfiles > 0
        ? `Detected ${manager} with ${lockfiles} lockfile(s)`
        : `Detected ${manager} without a lockfile`
      : "No supported dependency manager was detected; consistency was not checked",
    evidenceRef: `repository-analysis:${analysis.id}`,
    checkedAt: analysis.finishedAt ?? analysis.createdAt,
    ttlMs: ANALYSIS_TTL_MS,
    now,
  });
}
