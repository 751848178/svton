export interface LegacyReleasePlanSnapshot {
  id: string;
  projectId: string;
  releaseOrderId?: string | null;
}

export interface LegacyDeploymentRunSnapshot {
  id: string;
  projectId: string;
  status: string;
  artifactManifestId?: string | null;
  environmentVersionId?: string | null;
  legacyArtifactDigest?: string | null;
}

export interface LegacyEnvironmentVersionSnapshot {
  id: string;
  projectId: string;
  completedDeploymentRuns: number;
  currentEnvironmentVersionId?: string | null;
}

export interface ReleaseDeliveryMigrationSnapshot {
  releasePlans: LegacyReleasePlanSnapshot[];
  deploymentRuns: LegacyDeploymentRunSnapshot[];
  environments: LegacyEnvironmentVersionSnapshot[];
}

export interface ReleaseDeliveryMigrationIssue {
  entityType: "release_plan" | "deployment_run" | "environment";
  entityId: string;
  projectId: string;
  reason:
    | "release_order_link_missing"
    | "manifest_link_missing"
    | "environment_version_unverified";
  observedLegacyDigest?: string;
}

export interface ReleaseDeliveryMigrationReport {
  summary: {
    linkedReleasePlans: number;
    linkedDeploymentRuns: number;
    linkedEnvironmentVersions: number;
    unverified: number;
    syntheticManifests: 0;
  };
  issues: ReleaseDeliveryMigrationIssue[];
}
