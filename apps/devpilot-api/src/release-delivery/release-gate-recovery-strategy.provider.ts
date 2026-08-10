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
export class ReleaseGateRecoveryStrategyProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "release_recovery_capability";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M14", "M15"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    if (capabilityId === "M15") return false;
    return Boolean(context.promote?.releaseRun
      && context.promote.environment?.currentEnvironmentVersion);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.capabilityId === "M15") {
      return unavailable(
        "traffic_strategy_provider_missing",
        "未连接真实流量、指标自动中止和回切 Provider；高级策略不可执行",
        "No real traffic, metric-driven abort, and rollback provider is connected; advanced strategy is unavailable",
      );
    }
    if (definition.id === "D19") return this.previous(context, now);
    if (definition.id === "D20") return this.compatibility(context, now);
    return this.retention(context, now);
  }

  private previous(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const current = environment?.currentEnvironmentVersion;
    const previous = environment?.environmentVersions.find((item) =>
      item.id !== current?.id);
    if (!environment || !current || !previous) {
      return unavailable(
        "previous_stable_version_missing",
        "Production 没有可验证的上一稳定环境版本",
        "Production has no verifiable previous stable environment version",
      );
    }
    const manifestValid = /^sha256:[a-f0-9]{64}$/i.test(previous.artifactManifest.digest)
      && previous.artifactManifest.items.length > 0;
    const checked = previous.deploymentRun.status === "completed"
      && !previous.deploymentRun.dryRun && manifestValid;
    return evaluated({
      status: checked ? "checked" : "blocked",
      reasonCode: checked ? "previous_stable_artifact_available" : "previous_stable_artifact_invalid",
      zh: checked ? "上一稳定版本及其不可变制品可用于 recovery" : "上一版本的运行或制品完整性无效",
      en: checked ? "The previous stable version and immutable artifact are available for recovery" : "Previous-version run or artifact integrity is invalid",
      evidenceRef: `environment-version:${previous.id};artifact-manifest:${previous.artifactManifest.id}`,
      checkedAt: previous.effectiveAt,
      now,
    });
  }

  private compatibility(context: ReleaseGateEvidenceContext, now: Date) {
    const deployment = context.promote?.releaseRun?.deploymentRuns[0];
    const evidence = record(record(deployment?.result).recoveryCompatibility);
    if (!deployment || Object.keys(evidence).length === 0) {
      return unavailable(
        "recovery_compatibility_provider_missing",
        "没有代码与数据恢复兼容性检查证据",
        "No code and data recovery-compatibility evidence exists",
      );
    }
    const status: ReleaseGateStatus = evidence.status === "passed"
      ? "checked" : evidence.status === "failed" ? "blocked" : "manual";
    return evaluated({
      status,
      reasonCode: status === "checked" ? "recovery_compatibility_passed"
        : status === "blocked" ? "recovery_compatibility_failed" : "recovery_compatibility_manual",
      zh: status === "checked" ? "代码与数据恢复兼容性通过" : status === "blocked" ? "代码与数据恢复不兼容" : "恢复兼容性需要人工复核",
      en: status === "checked" ? "Code and data recovery compatibility passed" : status === "blocked" ? "Code and data are not recovery-compatible" : "Recovery compatibility requires manual review",
      evidenceRef: `deployment-run:${deployment.id}#recovery-compatibility`,
      checkedAt: deployment.finishedAt ?? deployment.createdAt,
      now,
    });
  }

  private retention(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const run = context.promote?.releaseRun;
    const approval = run?.operationApproval;
    const deployment = run?.deploymentRuns[0];
    const version = environment?.currentEnvironmentVersion;
    if (!environment || !run || !approval || !deployment || !version) {
      return unavailable(
        "release_evidence_incomplete",
        "发布运行、审批、部署或环境版本证据不完整",
        "Release run, approval, deployment, or environment-version evidence is incomplete",
      );
    }
    const checked = run.status === "succeeded"
      && approval.status === "approved"
      && deployment.status === "completed"
      && version.releaseRunId === run.id
      && version.deploymentRunId === deployment.id;
    return evaluated({
      status: checked ? "checked" : "blocked",
      reasonCode: checked ? "release_evidence_retained" : "release_evidence_inconsistent",
      zh: checked ? "发布、审批、制品、部署与当前版本证据均已留存" : "发布证据链不完整或不一致",
      en: checked ? "Release, approval, artifact, deployment, and current-version evidence is retained" : "Release evidence chain is incomplete or inconsistent",
      evidenceRef: `release-run:${run.id};operation-approval:${approval.id};environment-version:${version.id}`,
      checkedAt: run.finishedAt ?? run.createdAt,
      now,
    });
  }
}
