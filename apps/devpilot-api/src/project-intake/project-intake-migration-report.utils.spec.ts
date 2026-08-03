import { buildProjectIntakeMigrationReport } from "./project-intake-migration-report.utils";
import type { LegacyProjectIntakeSnapshot } from "./project-intake-preflight.types";

function project(
  overrides: Partial<LegacyProjectIntakeSnapshot> = {},
): LegacyProjectIntakeSnapshot {
  return {
    projectId: "project-1",
    teamId: "team-1",
    gitRepo: null,
    repository: null,
    environments: [],
    ...overrides,
  };
}

describe("buildProjectIntakeMigrationReport", () => {
  it("reports same-team SSH and HTTPS aliases without deleting either project", () => {
    const snapshots = [
      project({
        projectId: "project-https",
        repository: {
          id: "connection-https",
          provider: "github",
          repositoryUrl: "https://github.com/Example/Service.git",
          status: "connected",
        },
      }),
      project({
        projectId: "project-ssh",
        repository: {
          id: "connection-ssh",
          provider: "github",
          repositoryUrl: "git@github.com:example/service.git",
          status: "connected",
        },
      }),
    ];

    const report = buildProjectIntakeMigrationReport(snapshots);

    expect(report.repositoryIdentities).toHaveLength(2);
    expect(report.repositoryCollisions).toEqual([
      {
        teamId: "team-1",
        canonicalKey: "github.com/example/service",
        projectIds: ["project-https", "project-ssh"],
        repositoryConnectionIds: ["connection-https", "connection-ssh"],
      },
    ]);
    expect(
      report.lifecycleRecommendations.map((item) => item.suggestedStatus),
    ).toEqual(["needs_configuration", "needs_configuration"]);
  });

  it("does not collide identical repositories across teams", () => {
    const snapshots = ["team-a", "team-b"].map((teamId, index) =>
      project({
        projectId: `project-${index}`,
        teamId,
        gitRepo: "ssh://git@github.com/example/service.git",
      }),
    );

    expect(
      buildProjectIntakeMigrationReport(snapshots).repositoryCollisions,
    ).toEqual([]);
  });

  it("reports prod and production as ambiguous and retains both environments", () => {
    const snapshot = project({
      environments: [
        { id: "env-staging", key: "staging" },
        { id: "env-prod", key: "prod" },
        { id: "env-production", key: "production" },
        { id: "env-qa", key: "qa" },
      ],
    });

    const report = buildProjectIntakeMigrationReport([snapshot]);

    expect(report.baselineAssignments).toContainEqual({
      projectId: "project-1",
      environmentId: "env-staging",
      role: "staging",
    });
    expect(report.baselineAmbiguities).toEqual([
      {
        projectId: "project-1",
        role: "production",
        environmentIds: ["env-prod", "env-production"],
        keys: ["prod", "production"],
      },
    ]);
    expect(snapshot.environments).toHaveLength(4);
  });

  it("leaves an unverified legacy lifecycle unclassified instead of guessing draft or ready", () => {
    const report = buildProjectIntakeMigrationReport([
      project({
        gitRepo: "https://git.example.com/team/legacy.git",
        environments: [
          { id: "env-staging", key: "staging" },
          { id: "env-prod", key: "prod" },
        ],
      }),
    ]);

    expect(report.lifecycleRecommendations).toEqual([
      {
        projectId: "project-1",
        suggestedStatus: null,
        reasons: ["insufficient_legacy_evidence"],
      },
    ]);
  });

  it("recommends ready only for complete verified evidence with unique baselines", () => {
    const report = buildProjectIntakeMigrationReport([
      project({
        repository: {
          id: "connection-1",
          provider: "gitlab",
          repositoryUrl: "https://gitlab.example.com/team/service.git",
          status: "connected",
          lastAppliedRunId: "analysis-1",
          appliedAt: "2026-08-03T00:00:00.000Z",
        },
        environments: [
          { id: "env-staging", key: "staging" },
          { id: "env-prod", key: "prod" },
        ],
      }),
    ]);

    expect(report.lifecycleRecommendations).toEqual([
      {
        projectId: "project-1",
        suggestedStatus: "ready",
        reasons: ["verified_legacy_evidence"],
      },
    ]);
  });
});
