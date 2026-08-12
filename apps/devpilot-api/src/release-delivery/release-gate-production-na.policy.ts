import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { isMigrationNotApplicable } from "./release-gate-migration-applicability.evaluator";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

export function evaluateProductionNotApplicable(
  gateId: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  if (!["D08", "D12", "D15"].includes(gateId)) return null;
  const exact = exactStandardInput(context);
  if (!exact) {
    return unavailable(
      "production_applicability_frozen_fact_missing",
      "缺少绑定当前配置、部署输入与工作负载的冻结事实",
      "Frozen facts for the exact config, deployment input, and workload are missing",
    );
  }
  if (gateId === "D15") return tlsNotApplicable(context, exact, now);
  const references = exactResourceReferences(context);
  if (!references) {
    return unavailable(
      "resource_reference_snapshot_invalid",
      "冻结资源引用快照缺失或格式无效",
      "The frozen resource-reference snapshot is missing or invalid",
    );
  }
  const runtimeResources = references.filter((item) =>
    item.kind === "managed_resource" || item.kind === "resource_instance");
  if (gateId === "D08" && runtimeResources.length > 0) return null;
  if (gateId === "D12") {
    if (runtimeResources.some((item) => item.stateful !== false)) return null;
    const analysis = context.project.repositoryAnalysisRuns[0];
    const build = context.buildRuns[0];
    const migration = record(record(analysis?.result).migrationEvidence);
    if (
      !analysis ||
      analysis.status !== "succeeded" ||
      !build ||
      build.sourceCommitSha !== analysis.commitSha ||
      !isMigrationNotApplicable(migration)
    ) return null;
    return checked(gateId, context, exact, now, {
      reasonCode: "backup_not_applicable_stateless_without_resources",
      zh: "当前 Commit 无迁移面且冻结配置无有状态托管资源，备份不适用",
      en: "Backup is not applicable: the exact commit has no migration surface and the frozen config has no stateful managed resources",
      evidenceRef: `repository-analysis:${analysis.id};config-revision:${exact.revisionId}#backup-na`,
      checkedAt: analysis.finishedAt ?? analysis.createdAt,
    });
  }
  return checked(gateId, context, exact, now, {
    reasonCode: "resource_connectivity_not_applicable_zero_resources",
    zh: "冻结配置不引用数据库或中间件资源，连接检查不适用",
    en: "Resource connectivity is not applicable because the frozen config references no database or middleware resources",
    evidenceRef: `config-revision:${exact.revisionId}#zero-managed-resources`,
    checkedAt: exact.checkedAt,
  });
}

function tlsNotApplicable(
  context: ReleaseGateEvidenceContext,
  exact: ExactInput,
  now: Date,
) {
  const route = record(context.deploy?.environment?.currentConfigRevision?.routeSnapshot);
  const entries = Array.isArray(route.entries)
    ? route.entries.map(record)
    : [];
  if (
    route.tlsRequired !== false ||
    entries.length === 0 ||
    entries.some((entry) => entry.tlsMode !== "none")
  ) return null;
  return checked("D15", context, exact, now, {
    reasonCode: "tls_not_applicable_frozen_http_route",
    zh: "冻结的标准单主机入口明确使用 HTTP，TLS 证书检查不适用",
    en: "TLS certificate checks are not applicable to the frozen HTTP route on the standard single-host target",
    evidenceRef: `config-revision:${exact.revisionId}#tls-not-required`,
    checkedAt: exact.checkedAt,
  });
}

type ExactInput = { revisionId: string; snapshotHash: string; checkedAt: Date };

function exactStandardInput(context: ReleaseGateEvidenceContext): ExactInput | null {
  const target = context.decisionTarget;
  const revision = context.deploy?.environment?.currentConfigRevision;
  if (
    !target?.configRevisionId ||
    target.configRevisionId !== revision?.id ||
    !target.deploymentInputHash ||
    !target.workloadInputHash ||
    !target.providerKey ||
    !target.bindingId
  ) return null;
  const runPolicy = record(record(context.promote?.releaseRun?.policySnapshot).releasePolicy);
  const standard = context.promote?.releaseRun
    ? runPolicy.strategy === "standard" && runPolicy.requireProductionApproval === true
    : target.previewInputHash && target.releaseStrategy === "standard" &&
      target.requireProductionApproval === true;
  if (!standard) return null;
  const binding = context.deploy?.environment?.serverBindings.find(
    (item) => item.id === target.bindingId,
  );
  if (!binding || !["ssh-v1", "local-filesystem-v1"].includes(target.providerKey)) {
    return null;
  }
  return { revisionId: revision.id, snapshotHash: revision.snapshotHash,
    checkedAt: revision.createdAt };
}

function exactResourceReferences(context: ReleaseGateEvidenceContext) {
  const value = context.deploy?.environment?.currentConfigRevision?.resourceReferences;
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => record(item));
  if (parsed.some((item) =>
    typeof item.id !== "string" ||
    typeof item.kind !== "string" ||
    (["managed_resource", "resource_instance"].includes(String(item.kind)) &&
      typeof item.stateful !== "boolean"))) {
    return null;
  }
  return parsed as Array<{ id: string; kind: string; stateful?: boolean }>;
}

function checked(
  gateId: string,
  context: ReleaseGateEvidenceContext,
  exact: ExactInput,
  now: Date,
  fact: { reasonCode: string; zh: string; en: string; evidenceRef: string; checkedAt: Date },
) {
  const target = context.decisionTarget!;
  return evaluated({ ...fact, status: "checked", now, evidenceIdentity: {
    gateId, configRevisionId: exact.revisionId,
    configSnapshotHash: exact.snapshotHash,
    deploymentInputHash: target.deploymentInputHash!,
    workloadInputHash: target.workloadInputHash!,
    previewInputHash: target.previewInputHash ?? null,
    releaseRunId: target.releaseRunId ?? null,
  } });
}
