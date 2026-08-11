import { projectDeliverySummaryRecord } from "./project-delivery-summary.fixture";
import { presentProjectDeliverySummary } from "./project-delivery-summary.presenter";

describe("project delivery summary presenter", () => {
  it("presents only relation-backed F418 facts", () => {
    const result = presentProjectDeliverySummary(
      projectDeliverySummaryRecord(),
      "actor-1",
      "ssh-v1",
    );

    expect(result).toMatchObject({
      version: 2,
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
      resources: {
        bound: 4,
        total: 6,
        byEnvironment: { staging: 1, production: 3 },
      },
      entries: {
        active: 1,
        total: 2,
        unit: "site",
        productionDomain: "pay.example.com",
      },
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

    const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");

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

    const result = presentProjectDeliverySummary(record, "actor-2", "ssh-v1");

    expect(result.resources).toEqual({
      bound: 2,
      total: 4,
      byEnvironment: { staging: 0, production: 2 },
    });
    expect(result.entries).toEqual({
      active: 0,
      total: 1,
      unit: "site",
      productionDomain: null,
    });
    expect(result.baselines.staging?.ready).toBe(false);
    expect(result.scope.actorId).toBe("actor-2");
  });

  it("fails the whole intake summary closed for a cross-team finalization", () => {
    const record = projectDeliverySummaryRecord();
    record.intakeFinalizations[0].teamId = "team-other";

    expect(presentProjectDeliverySummary(record, "actor-1", "ssh-v1").intake).toEqual({
      projectType: null,
      architecture: null,
      componentCount: null,
    });
  });

  it("reports unresolved legacy component identity instead of filtering null", () => {
    const record = projectDeliverySummaryRecord();
    record.environments[0].applicationServices[0].releaseComponentKey = null;
    const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
    expect(result.checkpoints.find((item) => item.id === "services")).toMatchObject({
      status: "action_required",
      reasonCodes: ["legacy_component_identity_unresolved"],
      action: { href: "/projects/project-1/settings?section=repository" },
    });
  });

  it("uses exact provider readiness and environment settings deep links", () => {
    const record = projectDeliverySummaryRecord();
    record.environments[1].serverBindings[0].metadata = {
      releaseDeployment: { providerKey: "local-filesystem-v1", targetRef: "local" },
    };
    const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
    expect(result.checkpoints.find((item) =>
      item.id === "targets" && item.scope === "production")).toMatchObject({
      status: "blocked",
      reasonCodes: ["PROVIDER_MISMATCH"],
      action: {
        href: "/projects/project-1/settings?section=environments&env=production&envTab=targets",
      },
    });
  });

  it("maps each environment blocker to its exact five-step settings deep link", () => {
    const cases: Array<{
      tab: "variables" | "resources" | "routes" | "protection";
      mutate: (record: ReturnType<typeof projectDeliverySummaryRecord>) => void;
    }> = [
      {
        tab: "variables",
        mutate: (record) => { record.environments[1].currentConfigRevision = null; },
      },
      {
        tab: "resources",
        mutate: (record) => {
          record.environments[1].currentConfigRevision!.resourceReferences = [{
            id: "missing-resource",
            kind: "managed_resource",
            sharedEnvironmentIds: ["env-production"],
          }];
        },
      },
      {
        tab: "routes",
        mutate: (record) => { record.environments[1].applicationServices[0].ports = [4000]; },
      },
      {
        tab: "protection",
        mutate: (record) => {
          record.environments[1].currentConfigRevision!.environmentId = "env-staging";
        },
      },
    ];
    for (const value of cases) {
      const record = projectDeliverySummaryRecord();
      value.mutate(record);
      const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
      const checkpointId = value.tab === "routes" ? "routes" : "config";
      expect(result.checkpoints.find((item) =>
        item.id === checkpointId && item.scope === "production")?.action?.href).toBe(
        `/projects/project-1/settings?section=environments&env=production&envTab=${value.tab}`,
      );
    }
  });

  it("exposes open_release only as the server-owned current checkpoint", () => {
    const record = projectDeliverySummaryRecord();
    record.environments[1].currentEnvironmentVersion = null;
    const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
    expect(result.nextAction).toEqual({
      kind: "open_release",
      href: "/projects/project-1",
    });
    expect(result.checkpoints.find((item) => item.id === "release")?.action).toEqual(
      result.nextAction,
    );
  });

  it("fails frozen config hash and exact route target drift closed", () => {
    const record = projectDeliverySummaryRecord();
    const production = record.environments[1];
    production.currentConfigRevision!.snapshotHash = "0".repeat(64);
    const entries = (production.currentConfigRevision!.routeSnapshot as any).entries;
    entries[0].port = 9999;
    const result = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
    expect(result.checkpoints.find((item) =>
      item.id === "config" && item.scope === "production")?.reasonCodes).toEqual([
      "config_revision_hash_invalid",
    ]);
    expect(result.checkpoints.find((item) =>
      item.id === "routes" && item.scope === "production")?.reasonCodes).toEqual([
      "route_service_port_invalid",
    ]);
  });
});
