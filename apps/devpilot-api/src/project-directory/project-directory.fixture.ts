import { ProjectDirectoryRecord } from "./project-directory.repository";

export function projectDirectoryRecord(
  overrides: Partial<ProjectDirectoryRecord> = {},
): ProjectDirectoryRecord {
  return {
    id: "project-1",
    name: "Payments",
    description: "Payment service",
    onboardingStatus: "ready",
    onboardingRevision: 4,
    onboardingFinalizedAt: new Date("2026-08-03T01:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    createdBy: { id: "user-1", name: "Owner", email: "owner@example.com" },
    repositoryIdentity: {
      id: "identity-1",
      projectId: "project-1",
      provider: "github",
      canonicalKey: "github.com/example/payments",
      canonicalUrl: "https://github.com/example/payments",
      lockedAt: new Date("2026-08-03T01:00:00.000Z"),
      currentRevision: {
        id: "identity-revision-1",
        identityId: "identity-1",
        projectId: "project-1",
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
    environments: [
      projectDirectoryEnvironment("env-staging", "staging", "staging"),
      projectDirectoryEnvironment(
        "env-production",
        "production",
        "production",
        [
          {
            id: "deployment-1",
            status: "completed",
            dryRun: false,
            commitSha: "a".repeat(40),
            startedAt: new Date("2026-08-03T02:00:00.000Z"),
            finishedAt: new Date("2026-08-03T02:01:00.000Z"),
          },
        ],
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
    proxyConfigs: [
      { id: "proxy-1", domain: "payments.example.com", status: "active" },
    ],
    repositoryAnalysisRuns: [],
    deploymentRuns: [],
    releasePlans: [],
    auditEvents: [],
    _count: { applications: 1, applicationServices: 2 },
    ...overrides,
  } as ProjectDirectoryRecord;
}

export function projectDirectoryEnvironment(
  id: string,
  key: string,
  baselineRole: string,
  deploymentRuns: ProjectDirectoryRecord["environments"][number]["deploymentRuns"] = [],
): ProjectDirectoryRecord["environments"][number] {
  return {
    id,
    key,
    name: key,
    status: "active",
    baselineRole,
    identityLockedAt: new Date("2026-08-03T01:00:00.000Z"),
    currentConfigRevisionId: `revision-${id}`,
    deploymentRuns,
  };
}
