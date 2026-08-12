import type { ReleaseGateStatus } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";
import { runtimeResourceCoverage } from "./release-gate-resource-coverage.policy";

const CONNECTIVITY_TTL_MS = 15 * 60 * 1000;

export function evaluateResourceConnectivity(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.deploy?.environment;
  const coverage = runtimeResourceCoverage(context.deploy);
  if (!environment || !coverage?.length) return unavailable(
    "resource_connectivity_not_applicable",
    "当前配置没有可探测的数据库或中间件资源引用",
    "Current config has no database or middleware resource reference to probe",
  );
  const unresolved = coverage.find((item) => !item.managedResourceId);
  if (unresolved) return unavailable(
    unresolved.reasonCode ?? "resource_reference_unresolved",
    "资源引用缺少唯一、同环境的纳管资源映射",
    "A resource reference lacks a unique environment-scoped managed-resource mapping",
  );
  const runs = coverage.map((item) => context.deploy?.connections.find(
    (run) => run.resourceId === item.managedResourceId,
  ));
  if (runs.some((run) => !run)) return unavailable(
    "resource_connection_run_missing",
    "至少一个资源引用没有真实连接探测运行",
    "At least one resource reference has no real connection probe run",
  );
  const invalidScope = runs.some((run) => run?.environmentId !== environment.id);
  const notSucceeded = runs.some((run) =>
    !["succeeded", "completed"].includes(run?.status ?? ""));
  const dryRun = runs.some((run) => run?.dryRun);
  const status: ReleaseGateStatus = invalidScope || notSucceeded || dryRun
    ? "blocked" : "checked";
  const checkedAt = runs.reduce((oldest, run) => {
    const value = run?.finishedAt ?? run?.createdAt ?? oldest;
    return value.getTime() < oldest.getTime() ? value : oldest;
  }, new Date(8640000000000000));
  return evaluated({
    status,
    reasonCode: invalidScope ? "resource_environment_mismatch"
      : dryRun ? "resource_connection_dry_run"
        : notSucceeded ? "resource_connection_not_succeeded"
          : "resource_connections_succeeded",
    zh: status === "checked" ? `${coverage.length} 个资源引用均有真实连接探测`
      : "资源连接探测失败、dry-run 或环境归属不符",
    en: status === "checked"
      ? `${coverage.length} resource reference(s) have successful connection probes`
      : "A resource connection probe failed, is dry-run, or has wrong environment ownership",
    evidenceRef: runs.map((run) => `resource-connection:${run?.id}`).join(";"),
    checkedAt, ttlMs: CONNECTIVITY_TTL_MS, now,
    evidenceIdentity: status === "checked" ? {
      environmentId: environment.id,
      connectionRunIds: runs.map((run) => run!.id).sort().join(","),
      resourceRunMap: JSON.stringify(coverage.map((item, index) =>
        [item.managedResourceId, runs[index]!.id]).sort()),
    } : undefined,
  });
}
