import type { ProjectDirectoryRecord } from "./project-directory.repository";
import type {
  ProjectDirectoryEnvironmentSummary,
  ProjectDirectoryItem,
  ProjectDirectoryStatus,
} from "./project-directory.types";

type DirectoryEnvironment = ProjectDirectoryRecord["environments"][number];

export function baselineSummary(
  environment: DirectoryEnvironment,
): ProjectDirectoryEnvironmentSummary {
  return {
    id: environment.id,
    key: environment.key,
    name: environment.name,
    ready:
      environment.status === "active" &&
      environment.identityLockedAt !== null &&
      environment.currentConfigRevisionId !== null,
  };
}

export function productionSummary(
  project: ProjectDirectoryRecord,
  production: DirectoryEnvironment | undefined,
): ProjectDirectoryItem["production"] {
  if (!production) return { currentVersion: null, domain: null };
  const version = production.currentEnvironmentVersion;
  const deployment = version?.deploymentRun;
  const manifest = version?.artifactManifest;
  const versionValid =
    version?.teamId === project.teamId &&
    version.projectId === project.id &&
    version.environmentId === production.id &&
    version.releaseOrderId === version.releaseOrder.id &&
    version.releaseOrder.teamId === project.teamId &&
    version.releaseOrder.projectId === project.id &&
    version.artifactManifestId === manifest?.id &&
    manifest.teamId === project.teamId &&
    manifest.projectId === project.id &&
    manifest.releaseOrderId === version.releaseOrder.id &&
    deployment?.teamId === project.teamId &&
    deployment.projectId === project.id &&
    deployment.environmentId === production.id &&
    deployment.artifactManifestId === version.artifactManifestId &&
    deployment.status === "completed" &&
    deployment.dryRun === false;
  const domain =
    project.sites.find(
      (site) =>
        site.environmentId === production.id && site.status === "active",
    )?.primaryDomain ?? null;
  return {
    currentVersion: versionValid ? version.releaseOrder.releaseVersion : null,
    domain,
  };
}

export function projectDirectoryStatus(
  project: ProjectDirectoryRecord,
  proof: {
    repositoryReady: boolean;
    stagingReady: boolean;
    productionReady: boolean;
    productionOnline: boolean;
  },
): ProjectDirectoryStatus {
  const finalized =
    project.onboardingStatus === "ready" &&
    project.onboardingFinalizedAt !== null &&
    (project.onboardingRevision ?? 0) > 0;
  return finalized &&
    proof.repositoryReady &&
    proof.stagingReady &&
    proof.productionReady &&
    proof.productionOnline
    ? "online"
    : "needs_configuration";
}
