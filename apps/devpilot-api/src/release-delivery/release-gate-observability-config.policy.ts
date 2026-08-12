import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, record, unavailable } from "./release-gate-provider.types";
import { isKnownObservabilitySnapshot } from "../project-environment/environment-observability-snapshot.policy";

export function evaluateFrozenObservabilityConfig(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const target = context.decisionTarget;
  const revision = context.deploy?.environment?.currentConfigRevision;
  const snapshot = record(revision?.observabilitySnapshot);
  const complete = revision?.id === target?.configRevisionId &&
    target?.deploymentInputHash && target.workloadInputHash &&
    snapshot.version === 1 &&
    isKnownObservabilitySnapshot(snapshot);
  if (!complete || !revision) {
    return unavailable(
      "observability_config_not_frozen",
      "Production 配置修订尚未冻结日志、指标、Trace 与告警 Provider 配置",
      "The Production config revision has no frozen logs, metrics, trace, and alert provider configuration",
    );
  }
  if (
    snapshot.profile !== "local_acceptance_v1" ||
    target?.providerKey !== "local-filesystem-v1"
  ) {
    return unavailable(
      "observability_provider_missing",
      "当前仅注册本地验收可观测 Provider，且只能用于本地执行器",
      "Only the local-acceptance observability provider is registered, and it requires the local executor",
    );
  }
  return evaluated({
    status: "checked",
    reasonCode: "observability_config_frozen_local_acceptance",
    zh: "已冻结本地验收专用可观测性配置（不代表外部 Production Ready）",
    en: "Local-acceptance-only observability config is frozen; this is not external Production Ready",
    evidenceRef: `config-revision:${revision.id}#observability`,
    checkedAt: revision.createdAt,
    now,
    evidenceIdentity: {
      configRevisionId: revision.id,
      configSnapshotHash: revision.snapshotHash,
      deploymentInputHash: target.deploymentInputHash!,
      workloadInputHash: target.workloadInputHash!,
      profile: String(snapshot.profile),
    },
  });
}
