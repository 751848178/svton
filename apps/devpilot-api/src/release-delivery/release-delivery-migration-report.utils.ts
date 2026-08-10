import type {
  ReleaseDeliveryMigrationIssue,
  ReleaseDeliveryMigrationReport,
  ReleaseDeliveryMigrationSnapshot,
} from "./release-delivery-migration-report.types";

export function buildReleaseDeliveryMigrationReport(
  snapshot: ReleaseDeliveryMigrationSnapshot,
): ReleaseDeliveryMigrationReport {
  const issues: ReleaseDeliveryMigrationIssue[] = [];
  let linkedReleasePlans = 0;
  let linkedDeploymentRuns = 0;
  let linkedEnvironmentVersions = 0;

  for (const plan of snapshot.releasePlans) {
    if (plan.releaseOrderId) linkedReleasePlans += 1;
    else {
      issues.push({
        entityType: "release_plan",
        entityId: plan.id,
        projectId: plan.projectId,
        reason: "release_order_link_missing",
      });
    }
  }

  for (const run of snapshot.deploymentRuns) {
    if (run.artifactManifestId) linkedDeploymentRuns += 1;
    else {
      issues.push({
        entityType: "deployment_run",
        entityId: run.id,
        projectId: run.projectId,
        reason: "manifest_link_missing",
        ...(run.legacyArtifactDigest
          ? { observedLegacyDigest: run.legacyArtifactDigest }
          : {}),
      });
    }
    if (run.environmentVersionId) linkedEnvironmentVersions += 1;
  }

  for (const environment of snapshot.environments) {
    if (
      environment.completedDeploymentRuns > 0 &&
      !environment.currentEnvironmentVersionId
    ) {
      issues.push({
        entityType: "environment",
        entityId: environment.id,
        projectId: environment.projectId,
        reason: "environment_version_unverified",
      });
    }
  }

  issues.sort((left, right) =>
    `${left.entityType}:${left.entityId}`.localeCompare(
      `${right.entityType}:${right.entityId}`,
    ),
  );
  return {
    summary: {
      linkedReleasePlans,
      linkedDeploymentRuns,
      linkedEnvironmentVersions,
      unverified: issues.length,
      syntheticManifests: 0,
    },
    issues,
  };
}
