import { repositoryIntakeSummary } from "../project-intake/repository-intake-summary.utils";
import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { exactCurrentEnvironmentVersion } from "./current-environment-version.utils";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliveryBaselineSummary,
  ProjectDeliveryCurrentVersionSummary,
  ProjectDeliverySummaryResponse,
} from "./project-delivery-summary.types";

type Environment = ProjectDeliverySummaryRecord["environments"][number];
type ScopedResource = {
  teamId: string;
  projectId: string | null;
  environmentId: string | null;
};

export function presentProjectDeliverySummary(
  project: ProjectDeliverySummaryRecord,
  actorId: string,
): ProjectDeliverySummaryResponse {
  const staging = baseline(project, "staging");
  const production = baseline(project, "production");
  const activeEnvironmentIds = new Set(
    project.environments
      .filter(
        (item) => exactEnvironment(project, item) && item.status === "active",
      )
      .map(({ id }) => id),
  );
  const resources = resourceSummary(project, activeEnvironmentIds);
  const entries = entrySummary(project, activeEnvironmentIds, production?.id);
  return {
    version: 1,
    scope: { teamId: project.teamId, actorId, projectId: project.id },
    project: { id: project.id, name: project.name },
    repository: repository(project),
    intake: repositoryIntakeSummary(project),
    baselines: {
      staging: staging ? baselineSummary(project, staging) : null,
      production: production ? baselineSummary(project, production) : null,
    },
    resources,
    entries: { ...entries, unit: "site" },
    currentVersions: {
      staging: currentVersion(project, staging),
      production: currentVersion(project, production),
    },
  };
}

function repository(project: ProjectDeliverySummaryRecord) {
  const identity = project.repositoryIdentity;
  const revision = identity?.currentRevision;
  const scoped =
    identity?.teamId === project.teamId &&
    identity.projectId === project.id &&
    identity.lockedAt !== null &&
    revision?.teamId === project.teamId &&
    revision.projectId === project.id;
  if (
    !scoped ||
    !isStoredConnectionAligned(identity, project.repositoryConnection)
  ) {
    return null;
  }
  return {
    provider: identity.provider,
    canonicalUrl: identity.canonicalUrl,
    defaultBranch: revision.defaultBranch,
  };
}

function baseline(
  project: ProjectDeliverySummaryRecord,
  role: ProjectDeliveryBaselineRole,
) {
  return project.environments.find(
    (item) =>
      exactEnvironment(project, item) &&
      item.status === "active" &&
      item.baselineRole === role,
  );
}

function baselineSummary(
  project: ProjectDeliverySummaryRecord,
  environment: Environment,
): ProjectDeliveryBaselineSummary {
  const revision = environment.currentConfigRevision;
  const ready =
    environment.identityLockedAt !== null &&
    environment.currentConfigRevisionId === revision?.id &&
    revision.teamId === project.teamId &&
    revision.projectId === project.id &&
    revision.environmentId === environment.id;
  return {
    id: environment.id,
    key: environment.key,
    name: environment.name,
    ready,
  };
}

function currentVersion(
  project: ProjectDeliverySummaryRecord,
  environment: Environment | undefined,
): ProjectDeliveryCurrentVersionSummary | null {
  if (!environment) return null;
  const version = exactCurrentEnvironmentVersion(project, environment);
  const digest = version?.artifactManifest.digest?.trim();
  if (!version || !digest) return null;
  return {
    id: version.id,
    releaseOrderId: version.releaseOrder.id,
    releaseVersion: version.releaseOrder.releaseVersion,
    artifactManifestId: version.artifactManifest.id,
    manifestDigest: digest,
    deploymentRunId: version.deploymentRun.id,
    effectiveAt: version.effectiveAt.toISOString(),
  };
}

function resourceSummary(
  project: ProjectDeliverySummaryRecord,
  activeEnvironmentIds: Set<string>,
) {
  const rows: ScopedResource[] = [
    ...project.resourceInstances,
    ...project.managedResources,
    ...project.secretKeys,
    ...project.cdnConfigs,
    ...project.sites,
  ].filter((item) => exactResource(project, item));
  return {
    bound: rows.filter(
      (item) =>
        item.environmentId && activeEnvironmentIds.has(item.environmentId),
    ).length,
    total: rows.length,
  };
}

function entrySummary(
  project: ProjectDeliverySummaryRecord,
  activeEnvironmentIds: Set<string>,
  productionEnvironmentId: string | undefined,
) {
  const sites = project.sites.filter(
    (site) =>
      exactResource(project, site) && site.primaryDomain.trim().length > 0,
  );
  return {
    active: sites.filter(
      (site) =>
        site.status === "active" &&
        site.environmentId &&
        activeEnvironmentIds.has(site.environmentId),
    ).length,
    total: sites.length,
    productionDomain:
      sites
        .find(
          (site) =>
            site.status === "active" &&
            site.environmentId === productionEnvironmentId,
        )
        ?.primaryDomain.trim() ?? null,
  };
}

function exactEnvironment(
  project: ProjectDeliverySummaryRecord,
  environment: Environment,
) {
  return (
    environment.teamId === project.teamId &&
    environment.projectId === project.id
  );
}

function exactResource(
  project: ProjectDeliverySummaryRecord,
  resource: ScopedResource,
) {
  return (
    resource.teamId === project.teamId && resource.projectId === project.id
  );
}
