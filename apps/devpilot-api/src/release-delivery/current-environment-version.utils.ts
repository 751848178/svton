export interface CurrentEnvironmentVersionScope {
  id: string;
  teamId: string;
  projectId: string;
  currentEnvironmentVersionId: string | null;
  currentEnvironmentVersion: {
    id: string;
    teamId: string;
    projectId: string;
    environmentId: string;
    releaseOrderId: string;
    artifactManifestId: string;
    deploymentRunId: string;
    effectiveAt: Date;
    releaseOrder: {
      id: string;
      teamId: string;
      projectId: string;
      releaseVersion: string;
    };
    artifactManifest: {
      id: string;
      teamId: string;
      projectId: string;
      releaseOrderId: string;
      digest?: string;
    };
    deploymentRun: {
      id: string;
      teamId: string;
      projectId: string;
      environmentId: string | null;
      artifactManifestId: string | null;
      source: string;
      status: string;
      dryRun: boolean;
    };
  } | null;
}

export function exactCurrentEnvironmentVersion(
  project: { id: string; teamId: string },
  environment: CurrentEnvironmentVersionScope,
) {
  const version = environment.currentEnvironmentVersion;
  if (!version || environment.currentEnvironmentVersionId !== version.id)
    return null;
  const order = version.releaseOrder;
  const manifest = version.artifactManifest;
  const deployment = version.deploymentRun;
  const exact =
    environment.teamId === project.teamId &&
    environment.projectId === project.id &&
    version.teamId === project.teamId &&
    version.projectId === project.id &&
    version.environmentId === environment.id &&
    version.releaseOrderId === order.id &&
    order.teamId === project.teamId &&
    order.projectId === project.id &&
    version.artifactManifestId === manifest.id &&
    manifest.teamId === project.teamId &&
    manifest.projectId === project.id &&
    manifest.releaseOrderId === order.id &&
    version.deploymentRunId === deployment.id &&
    deployment.teamId === project.teamId &&
    deployment.projectId === project.id &&
    deployment.environmentId === environment.id &&
    deployment.artifactManifestId === manifest.id &&
    deployment.source === "release_order" &&
    deployment.status === "completed" &&
    deployment.dryRun === false;
  return exact ? version : null;
}
