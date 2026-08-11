import { Injectable } from "@nestjs/common";
import type { ReleaseGateDefinition } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { isMigrationNotApplicable } from "./release-gate-migration-applicability.evaluator";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

const STANDARD_NA_GATES = new Set(["P04", "P05", "P06", "P07", "P08", "P09"]);

@Injectable()
export class ReleaseGateProductionApplicabilityProvider {
  readonly providerKey = "production_standard_applicability_v1";

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (!context.decisionCheckpoint?.startsWith("production_")) return null;
    if (definition.id === "D06") return this.standard(definition.id, context, now);
    if (definition.id === "D09") return this.singleHost(context, now);
    if (definition.id === "D19") return this.rollbackCandidate(context, now);
    if (definition.id === "D20") return this.recoveryCompatibility(context, now);
    if (STANDARD_NA_GATES.has(definition.id)) {
      return this.standard(definition.id, context, now);
    }
    return null;
  }

  private standard(id: string, context: ReleaseGateEvidenceContext, now: Date) {
    const run = context.promote?.releaseRun;
    const policy = record(record(run?.policySnapshot).releasePolicy);
    if (!run || policy.strategy !== "standard" || policy.requireProductionApproval !== true) {
      return unavailable(
        "standard_strategy_fact_missing",
        "缺少绑定本次 ReleaseRun 的标准发布策略事实",
        "The exact ReleaseRun has no standard-strategy fact",
      );
    }
    const target = context.decisionTarget;
    const environment = context.deploy?.environment;
    const exactBinding = environment?.serverBindings.some((item) =>
      item.id === target?.bindingId);
    if (
      !target?.providerKey ||
      !["ssh-v1", "local-filesystem-v1"].includes(target.providerKey) ||
      !exactBinding
    ) {
      return unavailable(
        "standard_single_host_fact_missing",
        "缺少绑定本次动作的标准单主机目标事实",
        "The exact action has no standard single-host target fact",
      );
    }
    return evaluated({
      status: "checked",
      reasonCode: `${id.toLowerCase()}_not_applicable_standard_strategy`,
      zh: "标准单主机发布不使用高级流量或渐进观测策略（已按冻结策略判定）",
      en: "Advanced traffic or progressive-observation strategy is not applicable to the frozen standard single-host release",
      evidenceRef: `release-run:${run.id}#standard-strategy`,
      checkedAt: run.createdAt,
      now,
    });
  }

  private singleHost(context: ReleaseGateEvidenceContext, now: Date) {
    const target = context.decisionTarget;
    const environment = context.deploy?.environment;
    if (!target?.providerKey || !target.bindingId || !environment) {
      return unavailable("single_host_target_missing", "缺少精确单主机部署目标", "Exact single-host target is missing");
    }
    if (!["ssh-v1", "local-filesystem-v1"].includes(target.providerKey)) {
      return unavailable("network_policy_provider_missing", "当前 Provider 需要真实网络策略证据", "The provider requires real network-policy evidence");
    }
    const binding = environment.serverBindings.find((item) => item.id === target.bindingId);
    if (!binding) {
      return unavailable("single_host_binding_drift", "冻结的单主机绑定已漂移", "The frozen single-host binding drifted");
    }
    return evaluated({
      status: "checked",
      reasonCode: "network_policy_not_applicable_single_host",
      zh: "精确 Provider 目标为单主机，不需要服务发现或集群网络策略",
      en: "The exact provider target is single-host and does not require service discovery or cluster network policy",
      evidenceRef: `server-binding:${binding.id};provider:${target.providerKey}`,
      checkedAt: binding.updatedAt,
      now,
    });
  }

  private rollbackCandidate(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    if (!environment) return unavailable("production_environment_missing", "Production 环境不存在", "Production environment is missing");
    const current = environment.currentEnvironmentVersion;
    if (!current && environment.environmentVersions.length === 0) {
      const run = context.promote?.releaseRun;
      if (!run) return unavailable("first_release_fact_missing", "首次发布事实缺失", "First-release fact is missing");
      return evaluated({ status: "checked", reasonCode: "rollback_not_applicable_first_release", zh: "首次 Production 发布没有上一稳定版本（已判定不适用）", en: "No previous stable version exists for the first Production release", evidenceRef: `environment:${environment.id}#first-release`, checkedAt: run.createdAt, now });
    }
    const candidate = current
      ? environment.environmentVersions.find((item) => item.id === current.id)
      : undefined;
    if (!candidate) return unavailable("current_version_integrity_invalid", "Production 当前版本指针与历史不一致", "Production current-version pointer is inconsistent with history");
    const valid = candidate.deploymentRun.status === "completed" && !candidate.deploymentRun.dryRun && /^sha256:[a-f0-9]{64}$/i.test(candidate.artifactManifest.digest) && candidate.artifactManifest.items.length > 0;
    return evaluated({ status: valid ? "checked" : "blocked", reasonCode: valid ? "current_stable_artifact_recoverable" : "current_stable_artifact_invalid", zh: valid ? "发布前当前稳定版本可用于 recovery" : "发布前当前版本不可恢复", en: valid ? "The pre-release current stable version is recoverable" : "The pre-release current version is not recoverable", evidenceRef: `environment-version:${candidate.id};artifact-manifest:${candidate.artifactManifest.id}`, checkedAt: candidate.effectiveAt, now });
  }

  private recoveryCompatibility(context: ReleaseGateEvidenceContext, now: Date) {
    const analysis = context.project.repositoryAnalysisRuns[0];
    const evidence = record(record(analysis?.result).migrationEvidence);
    const build = context.buildRuns[0];
    if (!analysis || analysis.status !== "succeeded" || !build || build.sourceCommitSha !== analysis.commitSha || !isMigrationNotApplicable(evidence)) {
      return unavailable("recovery_compatibility_provider_missing", "存在迁移面或缺少绑定当前 Commit 的恢复兼容性 Provider", "A migration surface exists or exact-commit recovery-compatibility evidence is missing");
    }
    return evaluated({ status: "checked", reasonCode: "recovery_compatibility_not_applicable_stateless", zh: "仓库清单确认无数据库、Schema 或迁移面", en: "Repository inventory confirms no database, schema, or migration surface", evidenceRef: `repository-analysis:${analysis.id}#stateless-recovery`, checkedAt: analysis.finishedAt ?? analysis.createdAt, now });
  }
}
