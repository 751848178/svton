import { projectDeliverySummaryRecord } from "../release-delivery/project-delivery-summary.fixture";
import type { ProjectDirectoryRecord } from "./project-directory.repository";

export function projectDirectoryRecord(
  overrides: Partial<ProjectDirectoryRecord> = {},
): ProjectDirectoryRecord {
  const projectId = overrides.id ?? "project-1";
  const source = projectDeliverySummaryRecord({ id: projectId });
  source.name = "Payments";
  if (source.repositoryIdentity) {
    source.repositoryIdentity.projectId = projectId;
    if (source.repositoryIdentity.currentRevision) {
      source.repositoryIdentity.currentRevision.projectId = projectId;
    }
  }
  source.environments = [
    projectDirectoryEnvironment("env-staging", "staging", "staging", true, projectId),
    projectDirectoryEnvironment("env-production", "production", "production", true, projectId),
  ];
  source.sites = [projectDirectorySite({ projectId })];
  return {
    ...source,
    onboardingStatus: "ready",
    onboardingRevision: 4,
    onboardingFinalizedAt: new Date("2026-08-03T01:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    recentActivity: {
      id: projectId, projectId, activityType: "project", status: "ready",
      summary: null, occurredAt: new Date("2026-08-03T00:00:00.000Z"),
    },
    ...overrides,
  } as ProjectDirectoryRecord;
}

export function projectDirectorySite(
  overrides: Partial<ProjectDirectoryRecord["sites"][number]> = {},
): ProjectDirectoryRecord["sites"][number] {
  return {
    id: "site-1", teamId: "team-1", projectId: "project-1",
    primaryDomain: "payments.example.com", status: "active",
    environmentId: "env-production", ...overrides,
  };
}

export function projectDirectoryEnvironment(
  id: string,
  key: string,
  baselineRole: string,
  online = false,
  projectId = "project-1",
): ProjectDirectoryRecord["environments"][number] {
  const source = projectDeliverySummaryRecord().environments[
    baselineRole === "production" ? 1 : 0
  ];
  const environment = structuredClone(source);
  environment.id = id;
  environment.teamId = "team-1";
  environment.projectId = projectId;
  environment.key = key;
  environment.name = key;
  environment.baselineRole = baselineRole;
  environment.currentConfigRevisionId = `revision-${id}`;
  if (environment.currentConfigRevision) {
    environment.currentConfigRevision.id = `revision-${id}`;
    environment.currentConfigRevision.projectId = projectId;
    environment.currentConfigRevision.environmentId = id;
  }
  environment.currentEnvironmentVersionId = online
    ? `${id}-environment-version` : null;
  if (!online) environment.currentEnvironmentVersion = null;
  if (environment.currentEnvironmentVersion) {
    const version = environment.currentEnvironmentVersion;
    version.id = `${id}-environment-version`;
    version.projectId = projectId;
    version.environmentId = id;
    version.releaseOrder.projectId = projectId;
    version.artifactManifest.projectId = projectId;
    version.deploymentRun.projectId = projectId;
    version.deploymentRun.environmentId = id;
  }
  return environment;
}
