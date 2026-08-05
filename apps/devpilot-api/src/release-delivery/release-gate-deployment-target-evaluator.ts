import type { ReleaseGateStatus } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";

export function evaluateReleaseGateDeploymentTarget(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.deploy?.environment;
  if (!environment) {
    return unavailable(
      "target_environment_missing",
      "目标环境不存在或配置修订已漂移",
      "The target environment is missing or its config revision drifted",
    );
  }
  const deployment = context.deploy?.deployments[0];
  if (!deployment) return evaluateFrozenTarget(context, environment, now);
  const target = context.decisionTarget;
  const scoped = deployment.environmentId === environment.id;
  const exactManifest =
    !target?.manifestId || deployment.artifactManifestId === target.manifestId;
  const exactRun =
    !target?.deploymentRunId || deployment.id === target.deploymentRunId;
  const failed =
    deployment.status === "failed" || deployment.status === "blocked";
  const checked =
    scoped && exactManifest && exactRun && !deployment.dryRun && !failed;
  const status: ReleaseGateStatus = checked ? "checked" : "blocked";
  return evaluated({
    status,
    reasonCode: checked
      ? "deployment_target_bound"
      : !scoped
        ? "deployment_environment_mismatch"
        : !exactManifest
          ? "deployment_manifest_mismatch"
          : !exactRun
            ? "deployment_run_mismatch"
            : failed
              ? "deployment_target_failed"
              : "deployment_target_unverified",
    zh: checked
      ? `目标环境通过真实 ${deployment.targetType} DeploymentRun 绑定精确制品`
      : "部署目标运行失败、dry-run、缺少制品或环境归属不符",
    en: checked
      ? `The target environment is bound to an exact artifact by a real ${deployment.targetType} DeploymentRun`
      : "The deployment target run failed, is dry-run, lacks an artifact, or has wrong environment ownership",
    evidenceRef: `deployment-run:${deployment.id};environment:${environment.id}`,
    checkedAt: deployment.finishedAt ?? deployment.createdAt,
    now,
  });
}

function evaluateFrozenTarget(
  context: ReleaseGateEvidenceContext,
  environment: NonNullable<
    NonNullable<ReleaseGateEvidenceContext["deploy"]>["environment"]
  >,
  now: Date,
) {
  const target = context.decisionTarget;
  const revision = environment.currentConfigRevision;
  if (
    target?.environmentId === environment.id &&
    target.manifestId &&
    target.configRevisionId === (revision?.id ?? null)
  ) {
    return evaluated({
      status: "checked",
      reasonCode: "deployment_target_frozen",
      zh: "目标环境、配置修订与精确 Manifest 已冻结",
      en: "The target environment, config revision, and exact Manifest are frozen",
      evidenceRef: `environment:${environment.id};config-revision:${target.configRevisionId};manifest:${target.manifestId}`,
      checkedAt: revision?.createdAt ?? new Date(0),
      now,
    });
  }
  return evaluated({
    status: "unchecked",
    reasonCode: "deployment_target_not_observed",
    zh: "环境已绑定，但当前发布单尚无冻结目标或真实部署运行",
    en: "The environment is bound, but the release has no frozen target or real deployment run",
    evidenceRef: `environment:${environment.id}`,
    checkedAt: revision?.createdAt ?? new Date(0),
    now,
  });
}
