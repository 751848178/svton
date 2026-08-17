import type { ReleaseGateStatus } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";
import { runtimeResourceCoverage } from "./release-gate-resource-coverage.policy";

const BACKUP_TTL_MS = 24 * 60 * 60 * 1000;

export function evaluateBackupCoverage(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.deploy?.environment;
  const coverage = runtimeResourceCoverage(context.deploy);
  const stateful = coverage?.filter((item) => item.stateful) ?? [];
  if (!environment || !coverage || stateful.length === 0) return unavailable(
    "backup_run_missing",
    "没有当前环境的真实备份或恢复点运行",
    "No real backup or restore-point run exists for the current environment",
  );
  const unresolved = stateful.find((item) => !item.managedResourceId);
  if (unresolved) return unavailable(
    unresolved.reasonCode ?? "backup_resource_mapping_missing",
    "有状态资源引用缺少唯一纳管资源映射",
    "A stateful resource reference lacks a unique managed-resource mapping",
  );
  const runs = stateful.map((item) => context.deploy?.backups.find(
    (run) => run.resourceId === item.managedResourceId,
  ));
  if (runs.some((run) => !run)) return unavailable(
    "external_backup_provider_unsupported",
    "有状态资源需要外部备份 Provider 的精确恢复点，本环境尚未接入",
    "Stateful resources require exact restore points from an external backup provider, which is not configured",
  );
  const invalidScope = runs.some((run) => run?.environmentId !== environment.id);
  const failed = runs.some((run) =>
    run?.status === "failed" || run?.status === "blocked");
  const dryRun = runs.some((run) => run?.dryRun);
  const checked = !invalidScope && !failed && !dryRun &&
    runs.every((run) => run?.status === "completed");
  const status: ReleaseGateStatus = checked ? "checked"
    : invalidScope || failed ? "blocked" : "unchecked";
  const checkedAt = runs.reduce((oldest, run) => {
    const value = run?.finishedAt ?? run?.createdAt ?? oldest;
    return value.getTime() < oldest.getTime() ? value : oldest;
  }, new Date(8640000000000000));
  return evaluated({
    status,
    reasonCode: checked ? "backup_restore_point_available"
      : invalidScope ? "backup_environment_mismatch"
        : dryRun ? "backup_dry_run" : "backup_failed",
    zh: checked ? `${stateful.length} 个有状态资源引用均有真实恢复点`
      : "备份运行失败、dry-run 或环境归属不符",
    en: checked ? `${stateful.length} stateful resource reference(s) have real restore points`
      : "A backup run failed, is dry-run, or has wrong environment ownership",
    evidenceRef: runs.map((run) => `backup-run:${run?.id}`).join(";"),
    checkedAt, ttlMs: BACKUP_TTL_MS, now,
    evidenceIdentity: checked ? {
      environmentId: environment.id,
      backupRunIds: runs.map((run) => run!.id).sort().join(","),
      resourceRunMap: JSON.stringify(stateful.map((item, index) =>
        [item.managedResourceId, runs[index]!.id]).sort()),
    } : undefined,
  });
}
