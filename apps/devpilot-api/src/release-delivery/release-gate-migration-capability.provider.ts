import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluateBackupCoverage } from "./release-gate-backup-coverage.policy";
import { evaluateMigrationApplicability } from "./release-gate-migration-applicability.evaluator";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const MIGRATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReleaseGateMigrationCapabilityProvider implements ReleaseGateCapabilityProvider {
  readonly providerKey = "migration_backup_evidence";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M09"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const analysis = context.project.repositoryAnalysisRuns[0];
    return (
      Object.keys(record(record(analysis?.result).migrationEvidence)).length >
        0 || Boolean(context.deploy?.backups.length)
    );
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    return definition.id === "D12"
      ? evaluateBackupCoverage(context, now)
      : this.migration(definition.id, context, now);
  }

  private migration(
    id: string,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    const analysis = context.project.repositoryAnalysisRuns[0];
    const evidence = record(record(analysis?.result).migrationEvidence);
    if (
      !analysis ||
      analysis.status !== "succeeded" ||
      Object.keys(evidence).length === 0
    ) {
      return unavailable(
        "migration_provider_missing",
        "仓库解析未提供真实 Schema Drift 或迁移差异证据",
        "Repository analysis did not provide real Schema Drift or migration-diff evidence",
      );
    }
    const build = context.buildRuns[0];
    if (build && build.sourceCommitSha !== analysis.commitSha) {
      return unavailable(
        "migration_commit_mismatch",
        "迁移证据未绑定当前 BuildRun Commit",
        "Migration evidence is not bound to the current BuildRun Commit",
      );
    }
    const checkedAt =
      dateValue(evidence.checkedAt) ??
      analysis.finishedAt ??
      analysis.createdAt;
    const applicability = evaluateMigrationApplicability({
      gateId: id,
      evidence,
      analysisId: analysis.id,
      checkedAt,
      ttlMs: MIGRATION_TTL_MS,
      now,
    });
    if (applicability) return applicability;
    if (id === "D10") {
      const drift = evidence.schemaDrift;
      const ordered = evidence.orderValid;
      const status: ReleaseGateStatus =
        drift === false && ordered === true
          ? "checked"
          : drift === true || ordered === false
            ? "blocked"
            : "unchecked";
      return evaluated({
        status,
        reasonCode:
          drift === true
            ? "schema_drift_detected"
            : ordered === false
              ? "migration_order_invalid"
              : status === "checked"
                ? "schema_and_order_verified"
                : "migration_result_incomplete",
        zh:
          status === "checked"
            ? "Schema 无漂移且迁移顺序已验证"
            : status === "blocked"
              ? "检测到 Schema Drift 或迁移顺序无效"
              : "迁移证据不完整",
        en:
          status === "checked"
            ? "Schema has no drift and migration order is verified"
            : status === "blocked"
              ? "Schema Drift or invalid migration order was detected"
              : "Migration evidence is incomplete",
        evidenceRef: `repository-analysis:${analysis.id}#migration`,
        checkedAt,
        ttlMs: MIGRATION_TTL_MS,
        now,
      });
    }
    const destructive = Array.isArray(evidence.destructiveChanges)
      ? evidence.destructiveChanges
      : null;
    if (!destructive) {
      return evaluated({
        status: "unchecked",
        reasonCode: "destructive_diff_incomplete",
        zh: "未形成破坏性迁移差异结论",
        en: "No destructive-migration diff conclusion was produced",
        evidenceRef: `repository-analysis:${analysis.id}#migration`,
        checkedAt,
        ttlMs: MIGRATION_TTL_MS,
        now,
      });
    }
    return evaluated({
      status: destructive.length ? "manual" : "checked",
      reasonCode: destructive.length
        ? "destructive_changes_need_review"
        : "no_destructive_changes",
      zh: destructive.length
        ? `${destructive.length} 项破坏性变更需要人工复核`
        : "未检测到破坏性迁移或数据回填",
      en: destructive.length
        ? `${destructive.length} destructive change(s) require review`
        : "No destructive migration or backfill was detected",
      evidenceRef: `repository-analysis:${analysis.id}#migration`,
      checkedAt,
      ttlMs: MIGRATION_TTL_MS,
      now,
    });
  }

}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
