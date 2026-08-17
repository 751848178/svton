import { evaluated } from "./release-gate-provider.types";

export function evaluateMigrationApplicability(input: {
  gateId: string;
  evidence: Record<string, unknown>;
  analysisId: string;
  checkedAt: Date;
  now: Date;
  ttlMs: number;
}) {
  if (!isMigrationNotApplicable(input.evidence)) return null;
  return evaluated({
    status: "checked",
    reasonCode:
      input.gateId === "D10"
        ? "schema_migration_not_applicable"
        : "destructive_migration_not_applicable",
    zh: "当前 Commit 的仓库清单没有数据库、Schema、迁移文件或 migrate 命令",
    en: "The current-commit inventory has no database, schema, migration file, or migrate command",
    evidenceRef: `repository-analysis:${input.analysisId}#migration-applicability`,
    checkedAt: input.checkedAt,
    ttlMs: input.ttlMs,
    now: input.now,
  });
}

export function isMigrationNotApplicable(evidence: Record<string, unknown>) {
  return (
    evidence.providerKey === "repository_inventory_v1" &&
    evidence.applicable === false &&
    evidence.reasonCode === "no_schema_or_migration_surface" &&
    empty(evidence.detectedFiles) &&
    empty(evidence.commandServices) &&
    empty(evidence.databaseKinds)
  );
}

function empty(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}
