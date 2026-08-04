import type { ProjectDirectoryRecord } from "./project-directory.repository";

export function projectDirectoryRecord(
  overrides: Partial<ProjectDirectoryRecord> = {},
): ProjectDirectoryRecord {
  const projectId = overrides.id ?? "project-1";
  return {
    id: projectId,
    teamId: "team-1",
    name: "Payments",
    config: intakeConfig(),
    onboardingStatus: "ready",
    onboardingRevision: 4,
    onboardingFinalizedAt: new Date("2026-08-03T01:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    repositoryIdentity: {
      id: "identity-1",
      projectId,
      provider: "github",
      canonicalKey: "github.com/example/payments",
      canonicalUrl: "https://github.com/example/payments",
      lockedAt: new Date("2026-08-03T01:00:00.000Z"),
      currentRevision: {
        id: "identity-revision-1",
        identityId: "identity-1",
        projectId,
        revision: 1,
        defaultBranch: "main",
        reason: "initial",
        createdAt: new Date("2026-08-03T01:00:00.000Z"),
      },
    },
    repositoryConnection: {
      provider: "github",
      repositoryUrl: "git@github.com:example/payments.git",
      defaultBranch: "main",
      selectedBranch: "main",
      commitSha: "a".repeat(40),
      status: "connected",
    },
    repositoryIntakeReviewSnapshots: [
      {
        id: "snapshot-1",
        decisions: intakeDecisions(),
        createdAt: new Date("2026-08-03T01:10:00.000Z"),
      },
    ],
    environments: [
      projectDirectoryEnvironment(
        "env-staging",
        "staging",
        "staging",
        false,
        projectId,
      ),
      projectDirectoryEnvironment(
        "env-production",
        "production",
        "production",
        true,
        projectId,
      ),
    ],
    sites: [
      {
        id: "site-1",
        primaryDomain: "payments.example.com",
        status: "active",
        environmentId: "env-production",
      },
    ],
    recentActivity: {
      id: projectId,
      projectId,
      activityType: "project",
      status: "ready",
      summary: null,
      occurredAt: new Date("2026-08-03T00:00:00.000Z"),
    },
    ...overrides,
  } as ProjectDirectoryRecord;
}

export function projectDirectoryEnvironment(
  id: string,
  key: string,
  baselineRole: string,
  online = false,
  projectId = "project-1",
): ProjectDirectoryRecord["environments"][number] {
  return {
    id,
    key,
    name: key,
    status: "active",
    baselineRole,
    identityLockedAt: new Date("2026-08-03T01:00:00.000Z"),
    currentConfigRevisionId: `revision-${id}`,
    currentEnvironmentVersion: online
      ? {
          id: "environment-version-1",
          teamId: "team-1",
          projectId,
          environmentId: id,
          releaseOrderId: "release-order-1",
          artifactManifestId: "manifest-1",
          effectiveAt: new Date("2026-08-03T02:00:00.000Z"),
          releaseOrder: {
            id: "release-order-1",
            teamId: "team-1",
            projectId,
            releaseVersion: "2.3.2",
          },
          artifactManifest: {
            id: "manifest-1",
            teamId: "team-1",
            projectId,
            releaseOrderId: "release-order-1",
          },
          deploymentRun: {
            id: "deployment-1",
            teamId: "team-1",
            projectId,
            environmentId: id,
            artifactManifestId: "manifest-1",
            status: "completed",
            dryRun: false,
          },
        }
      : null,
  };
}

function intakeConfig() {
  return {
    repositoryAnalysis: {
      intakeContract: {
        version: 1,
        overview: {
          projectType: "web_application",
          architecture: "monorepo",
        },
      },
    },
  };
}

function intakeDecisions() {
  const component = (name: string, path: string) => ({
    kind: "application_service",
    decision: "accept",
    reviewedValue: {
      metadata: {
        repositoryAnalysis: {
          intakeContract: { name, path, type: "backend_service" },
        },
      },
    },
  });
  return [
    {
      kind: "project_repository",
      decision: "accept",
      reviewedValue: {
        intakeContract: intakeConfig().repositoryAnalysis.intakeContract,
      },
    },
    component("web", "apps/web"),
    component("api", "apps/api"),
  ];
}
