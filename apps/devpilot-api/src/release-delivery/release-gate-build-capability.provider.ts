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

const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReleaseGateBuildCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "build_quality_security";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M03", "M04"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const build = context.buildRuns[0];
    if (capabilityId === "M03") return Boolean(build);
    const security = record(record(build?.gateSummary).security);
    return ["secretScan", "sast", "vulnerabilities"].some((key) => {
      const evidence = record(security[key]);
      return Object.keys(evidence).length > 0
        && evidence.status !== "unavailable"
        && evidence.status !== "not_configured";
    });
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.capabilityId === "M03") {
      return this.build(definition.id, context, now);
    }
    return this.security(definition.id, context, now);
  }

  private build(id: string, context: ReleaseGateEvidenceContext, now: Date) {
    if (id === "C08") return this.lockfile(context, now);
    const build = context.buildRuns[0];
    if (!build) {
      return unavailable("build_missing", "发布单尚无 BuildRun 证据", "The release order has no BuildRun evidence");
    }
    const summary = record(build.gateSummary);
    if (id === "B02") {
      const status = build.status === "succeeded"
        ? "checked" : build.status === "failed" ? "blocked" : "unchecked";
      return evaluated({
        status,
        reasonCode: status === "checked" ? "build_succeeded" : status === "blocked" ? build.errorCode ?? "build_failed" : "build_in_progress",
        zh: status === "checked" ? `Build #${build.revision} 已完成受影响组件编译打包` : status === "blocked" ? `Build #${build.revision} 构建失败` : `Build #${build.revision} 尚未完成`,
        en: status === "checked" ? `Build #${build.revision} compiled and packaged its components` : status === "blocked" ? `Build #${build.revision} failed` : `Build #${build.revision} is not complete`,
        evidenceRef: `build-run:${build.id}`,
        checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
        now,
      });
    }
    const key = id === "C09" ? "quality" : id === "B01" ? "install" : "tests";
    return this.structuredBuildResult(
      record(summary[key]),
      key,
      build,
      now,
    );
  }

  private lockfile(context: ReleaseGateEvidenceContext, now: Date) {
    const analysis = context.project.repositoryAnalysisRuns[0];
    if (!analysis || analysis.status !== "succeeded") {
      return unavailable(
        "dependency_analysis_missing",
        "缺少成功的精确 Commit 依赖分析",
        "Successful exact-Commit dependency analysis is missing",
      );
    }
    const build = context.buildRuns[0];
    if (build && build.sourceCommitSha !== analysis.commitSha) {
      return unavailable(
        "dependency_analysis_commit_mismatch",
        "依赖分析未绑定当前 BuildRun Commit",
        "Dependency analysis is not bound to the current BuildRun Commit",
      );
    }
    const repository = record(record(analysis.result).repository);
    const manager = typeof repository.packageManager === "string"
      ? repository.packageManager : null;
    const lockfiles = Array.isArray(repository.lockfiles)
      ? repository.lockfiles.length : 0;
    const status: ReleaseGateStatus = manager
      ? lockfiles > 0 ? "checked" : "blocked"
      : "unchecked";
    return evaluated({
      status,
      reasonCode: manager
        ? lockfiles > 0 ? "dependency_lock_detected" : "dependency_lock_missing"
        : "dependency_manager_not_detected",
      zh: manager
        ? lockfiles > 0 ? `检测到 ${manager} 和 ${lockfiles} 个锁文件` : `检测到 ${manager}，但没有锁文件`
        : "未检测到受支持的依赖管理器，未执行一致性检查",
      en: manager
        ? lockfiles > 0 ? `Detected ${manager} with ${lockfiles} lockfile(s)` : `Detected ${manager} without a lockfile`
        : "No supported dependency manager was detected; consistency was not checked",
      evidenceRef: `repository-analysis:${analysis.id}`,
      checkedAt: analysis.finishedAt ?? analysis.createdAt,
      ttlMs: ANALYSIS_TTL_MS,
      now,
    });
  }

  private structuredBuildResult(
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
    const status = normalizeStatus(evidence.status);
    return evaluated({
      status,
      reasonCode: `${key}_${String(evidence.status ?? "unknown")}`,
      zh: status === "checked" ? `${key} 检查通过` : status === "blocked" ? `${key} 检查阻断` : `${key} 检查未通过门禁`,
      en: status === "checked" ? `${key} check passed` : status === "blocked" ? `${key} check blocked` : `${key} check did not pass the gate`,
      evidenceRef: `build-run:${build.id}#${key}`,
      checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
      now,
    });
  }

  private security(id: string, context: ReleaseGateEvidenceContext, now: Date) {
    const build = context.buildRuns[0];
    if (!build) {
      return unavailable("security_build_missing", "没有可绑定安全证据的 BuildRun", "No BuildRun exists for security evidence");
    }
    const key = id === "C07" ? "secretScan" : id === "C10" ? "sast" : "vulnerabilities";
    const evidence = record(record(record(build.gateSummary).security)[key]);
    if (Object.keys(evidence).length === 0) {
      return unavailable(
        `${key}_provider_missing`,
        `未连接 ${key} 安全工具 Provider；隔离与脱敏控制不能替代扫描`,
        `No ${key} security-tool provider is connected; isolation and redaction do not substitute for scanning`,
      );
    }
    return this.structuredBuildResult(evidence, key, build, now);
  }

}

function normalizeStatus(value: unknown): ReleaseGateStatus {
  if (value === "passed" || value === "checked" || value === "succeeded") return "checked";
  if (value === "failed" || value === "blocked") return "blocked";
  if (value === "warning") return "warning";
  if (value === "manual" || value === "needs_human") return "manual";
  if (value === "unavailable") return "unavailable";
  return "unchecked";
}
