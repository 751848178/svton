import { exactCurrentEnvironmentVersion } from "./current-environment-version.utils";
import { presentProjectDeliveryBaseline } from "./project-delivery-baseline.policy";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type { ProjectDeliveryBaselineRole, ProjectDeliveryCheckpoint,
  ProjectDeliveryCurrentVersionSummary } from "./project-delivery-summary.types";

type Environment = ProjectDeliverySummaryRecord["environments"][number];

export function presentCompleteProjectDeliveryBaseline(
  project: ProjectDeliverySummaryRecord,
  environment: Environment | undefined,
  role: ProjectDeliveryBaselineRole,
  version: ProjectDeliveryCurrentVersionSummary | null,
  checkpoints: ProjectDeliveryCheckpoint[],
) {
  if (!environment) return null;
  const baseline = presentProjectDeliveryBaseline(project, environment);
  const required = checkpoints.filter((item) => item.scope === role ||
    (item.scope === "project" && item.id !== "release"));
  return { ...baseline, ready: baseline.ready && Boolean(version) &&
    required.every((item) => item.status === "ready") };
}

export function presentProjectDeliveryCurrentVersion(
  project: ProjectDeliverySummaryRecord,
  environment: Environment | undefined,
): ProjectDeliveryCurrentVersionSummary | null {
  if (!environment) return null;
  const version = exactCurrentEnvironmentVersion(project, environment);
  const digest = version?.artifactManifest.digest?.trim();
  if (!version || !digest) return null;
  return {
    id: version.id, releaseOrderId: version.releaseOrder.id,
    releaseVersion: version.releaseOrder.releaseVersion,
    artifactManifestId: version.artifactManifest.id, manifestDigest: digest,
    deploymentRunId: version.deploymentRun.id,
    effectiveAt: version.effectiveAt.toISOString(),
  };
}
