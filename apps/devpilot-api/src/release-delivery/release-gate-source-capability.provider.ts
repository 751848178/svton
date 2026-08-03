import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const SOURCE_TTL_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_TTL_MS = 7 * SOURCE_TTL_MS;

@Injectable()
export class ReleaseGateSourceCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "repository_commit_analysis";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M01", "M02"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return capabilityId === "M01"
      ? Boolean(context.project.repositoryConnection)
      : Boolean(context.project.repositoryAnalysisRuns[0]);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    return definition.capabilityId === "M01"
      ? this.source(definition.id, context, now)
      : this.analysis(definition.id, context, now);
  }

  private source(id: string, context: ReleaseGateEvidenceContext, now: Date) {
    const connection = context.project.repositoryConnection;
    if (!connection) {
      return unavailable("repository_not_connected", "项目尚未连接仓库", "The project has no repository connection");
    }
    if (id !== "C01") {
      return unavailable(
        id === "C02" ? "merge_state_provider_missing" : "required_checks_provider_missing",
        id === "C02" ? "未连接合并、落后和冲突状态 Provider" : "未连接必需 CI 和代码审批 Provider",
        id === "C02" ? "No merge, behind, or conflict-state provider is connected" : "No required CI and code-review provider is connected",
      );
    }
    const checkedAt = connection.verifiedAt ?? connection.updatedAt;
    const reference = `repository-connection:${connection.id}`;
    if (connection.status === "failed") {
      return evaluated({
        status: "blocked", reasonCode: connection.errorCode ?? "repository_verification_failed",
        zh: "仓库连接验证失败", en: "Repository connection verification failed",
        evidenceRef: reference, checkedAt, ttlMs: SOURCE_TTL_MS, now,
      });
    }
    if (connection.status !== "connected" || !connection.verifiedAt) {
      return evaluated({
        status: "unchecked", reasonCode: "repository_not_verified",
        zh: "仓库连接尚未完成真实验证", en: "The repository connection has not been verified",
        evidenceRef: reference, checkedAt, ttlMs: SOURCE_TTL_MS, now,
      });
    }
    const build = context.buildRuns[0];
    if (!build) {
      return evaluated({
        status: "unchecked", reasonCode: "commit_not_locked_by_build",
        zh: "仓库已验证，但发布单尚未由 BuildRun 锁定 Commit",
        en: "The repository is verified, but no BuildRun has locked a Commit",
        evidenceRef: reference, checkedAt, ttlMs: SOURCE_TTL_MS, now,
      });
    }
    const source = record(record(build.gateSummary).source);
    const expectedBranch = connection.defaultBranch ?? connection.selectedBranch;
    const mismatched = Boolean(expectedBranch && expectedBranch !== build.sourceBranch);
    const failed = source.status === "failed";
    return evaluated({
      status: mismatched || failed ? "blocked" : "checked",
      reasonCode: mismatched ? "default_branch_mismatch" : failed ? "source_checkout_failed" : "exact_commit_resolved",
      zh: mismatched || failed
        ? "BuildRun 来源与已验证主分支不一致或精确检出失败"
        : `已解析并锁定 ${build.sourceBranch}@${build.sourceCommitSha.slice(0, 12)}`,
      en: mismatched || failed
        ? "BuildRun source differs from the verified default branch or exact checkout failed"
        : `Resolved and locked ${build.sourceBranch}@${build.sourceCommitSha.slice(0, 12)}`,
      evidenceRef: `${reference};build-run:${build.id}`,
      checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
      ttlMs: SOURCE_TTL_MS,
      now,
    });
  }

  private analysis(id: string, context: ReleaseGateEvidenceContext, now: Date) {
    const analysis = context.project.repositoryAnalysisRuns[0];
    if (!analysis) {
      return unavailable("analysis_missing", "尚无 Commit 绑定的仓库分析证据", "No Commit-bound repository analysis evidence exists");
    }
    const checkedAt = analysis.finishedAt ?? analysis.createdAt;
    const reference = `repository-analysis:${analysis.id}`;
    if (analysis.status !== "succeeded") {
      return evaluated({
        status: "blocked", reasonCode: analysis.errorCode ?? "analysis_failed",
        zh: "仓库分析未成功", en: "Repository analysis did not succeed",
        evidenceRef: reference, checkedAt, ttlMs: ANALYSIS_TTL_MS, now,
      });
    }
    const build = context.buildRuns[0];
    if (build && build.sourceCommitSha !== analysis.commitSha) {
      return evaluated({
        status: "unchecked", reasonCode: "analysis_commit_mismatch",
        zh: "仓库分析未绑定当前 BuildRun 的 Commit", en: "Repository analysis is not bound to the current BuildRun Commit",
        evidenceRef: reference, checkedAt, ttlMs: ANALYSIS_TTL_MS, now,
      });
    }
    const result = record(analysis.result);
    if (id === "C05") {
      const repository = record(result.repository);
      const services = Array.isArray(result.services) ? result.services.length : 0;
      return evaluated({
        status: services > 0 ? "checked" : "unchecked",
        reasonCode: services > 0 ? "component_scope_identified" : "component_scope_empty",
        zh: services > 0
          ? `精确 Commit 分析识别 ${services} 个组件（Monorepo：${repository.monorepo === true ? "是" : "否"}）`
          : "分析未识别可交付组件",
        en: services > 0
          ? `Exact-Commit analysis identified ${services} component(s) (monorepo: ${repository.monorepo === true ? "yes" : "no"})`
          : "Analysis did not identify any deliverable component",
        evidenceRef: reference, checkedAt, ttlMs: ANALYSIS_TTL_MS, now,
      });
    }
    const impact = record(result.changeImpact);
    const directories = Array.isArray(impact.highRiskDirectories)
      ? impact.highRiskDirectories : null;
    if (!directories) {
      return unavailable(
        "change_diff_provider_missing",
        "仓库拓扑已分析，但未连接基线差异和高风险目录 Provider",
        "Repository topology was analyzed, but no baseline diff or high-risk directory provider is connected",
      );
    }
    return evaluated({
      status: directories.length ? "manual" : "checked",
      reasonCode: directories.length ? "high_risk_changes_need_review" : "no_high_risk_changes",
      zh: directories.length ? `检测到 ${directories.length} 个高风险目录，需要人工复核` : "未检测到高风险目录变更",
      en: directories.length ? `${directories.length} high-risk directorie(s) require review` : "No high-risk directory changes were detected",
      evidenceRef: reference, checkedAt, ttlMs: ANALYSIS_TTL_MS, now,
    });
  }
}
