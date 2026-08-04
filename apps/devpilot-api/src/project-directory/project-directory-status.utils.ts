import type { ProjectDirectoryRecord } from "./project-directory.repository";
import { exactCurrentEnvironmentVersion } from "../release-delivery/current-environment-version.utils";
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
  const version = exactCurrentEnvironmentVersion(project, production);
  const productionSite = project.sites.find(
    (site) =>
      site.teamId === project.teamId &&
      site.projectId === project.id &&
      site.environmentId === production.id &&
      site.status === "active" &&
      site.primaryDomain.trim().length > 0,
  );
  return {
    currentVersion: version?.releaseOrder.releaseVersion ?? null,
    domain: productionSite?.primaryDomain.trim() ?? null,
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
