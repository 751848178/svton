import { projectDeliverySummaryRecord } from "./project-delivery-summary.fixture";
import { presentProjectDeliverySummary } from "./project-delivery-summary.presenter";

describe("project delivery summary presenter", () => {
  it("presents only relation-backed F418 facts", () => {
    const result = presentProjectDeliverySummary(
      projectDeliverySummaryRecord(),
      "actor-1",
    );

    expect(result).toMatchObject({
      version: 1,
      scope: { teamId: "team-1", actorId: "actor-1", projectId: "project-1" },
      repository: {
        provider: "github",
        canonicalUrl: "https://github.com/example/payments",
        defaultBranch: "main",
      },
      intake: {
        projectType: "web_application",
        architecture: "monorepo",
        componentCount: 1,
      },
      baselines: { staging: { ready: true }, production: { ready: true } },
      resources: { bound: 4, total: 6 },
      entries: { active: 1, total: 2, unit: "site" },
      currentVersions: {
        staging: {
          releaseVersion: "2.4.0-rc.1",
          deploymentRunId: "deployment-staging",
        },
        production: {
          releaseVersion: "2.3.2",
          deploymentRunId: "deployment-production",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("gitRepo");
    expect(JSON.stringify(result)).not.toContain("buildRuns");
  });

  it("fails canonical identity and exact current version evidence closed", () => {
    const record = projectDeliverySummaryRecord();
    const staging = record.environments[0]?.currentEnvironmentVersion;
    const production = record.environments[1]?.currentEnvironmentVersion;
    if (!record.repositoryIdentity || !staging || !production) {
      throw new Error(
        "fixture must contain identity and both current versions",
      );
    }
    record.repositoryIdentity.lockedAt = null;
    staging.deploymentRun.source = "manual";
    production.deploymentRun.dryRun = true;

    const result = presentProjectDeliverySummary(record, "actor-1");

    expect(result.repository).toBeNull();
    expect(result.currentVersions).toEqual({ staging: null, production: null });
  });

  it("excludes cross-scope rows and requires exact config ownership", () => {
    const record = projectDeliverySummaryRecord();
    const stagingConfig = record.environments[0]?.currentConfigRevision;
    if (!stagingConfig) throw new Error("fixture must contain Staging config");
    record.resourceInstances[0].teamId = "team-other";
    record.sites[0].projectId = "project-other";
    stagingConfig.projectId = "project-other";

    const result = presentProjectDeliverySummary(record, "actor-2");

    expect(result.resources).toEqual({ bound: 2, total: 4 });
    expect(result.entries).toEqual({ active: 0, total: 1, unit: "site" });
    expect(result.baselines.staging?.ready).toBe(false);
    expect(result.scope.actorId).toBe("actor-2");
  });

  it("fails the whole intake summary closed for a cross-team finalization", () => {
    const record = projectDeliverySummaryRecord();
    record.intakeFinalizations[0].teamId = "team-other";

    expect(presentProjectDeliverySummary(record, "actor-1").intake).toEqual({
      projectType: null,
      architecture: null,
      componentCount: null,
    });
  });
});
