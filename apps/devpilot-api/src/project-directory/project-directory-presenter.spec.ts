import "reflect-metadata";
import {
  projectDirectoryEnvironment,
  projectDirectoryRecord,
  projectDirectorySite,
} from "./project-directory.fixture";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";
import { presentProjectDeliverySummary } from "../release-delivery/project-delivery-summary.presenter";

const present = (record: ReturnType<typeof projectDirectoryRecord>) =>
  toProjectDirectoryItem(record, "ssh-v1");

describe("project directory presenter", () => {
  it("exposes every environment with its current version and derives latestReleaseAt", () => {
    const record = projectDirectoryRecord();
    const item = present(record);
    // 列表页动态环境列：每个环境一项，键与版本齐备
    expect(item.environments.length).toBe(record.environments.length);
    for (const environment of record.environments) {
      const column = item.environments.find((entry) => entry.id === environment.id);
      expect(column).toBeDefined();
      expect(column?.key).toBe(environment.key);
    }
    // latestReleaseAt = 各环境当前版本生效时间的最大值
    const effectiveDates = item.environments
      .map((entry) => entry.currentVersionEffectiveAt)
      .filter((value): value is string => Boolean(value));
    expect(item.latestReleaseAt).toBe(
      effectiveDates.reduce((latest, value) => (value > latest ? value : latest), effectiveDates[0]),
    );
  });

  it("exposes components with the first declared port", () => {
    const item = present(projectDirectoryRecord());
    expect(Array.isArray(item.components)).toBe(true);
    for (const component of item.components) {
      expect(typeof component.name).toBe("string");
      expect(component.port === null || Number.isInteger(component.port)).toBe(true);
    }
  });

  it("nulls latestReleaseAt when no environment has a live version", () => {
    const record = projectDirectoryRecord();
    for (const environment of record.environments) {
      environment.currentEnvironmentVersion = null;
      environment.currentEnvironmentVersionId = null;
    }
    const item = present(record);
    expect(item.environments.every((entry) => entry.currentVersion === null)).toBe(true);
    expect(item.latestReleaseAt).toBeNull();
  });

  it("projects the exact detail readiness checkpoints and next action", () => {
    const record = projectDirectoryRecord();
    const directory = present(record);
    const detail = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");

    expect(directory.checkpoints).toEqual(detail.checkpoints);
    expect(directory.nextAction).toEqual(detail.nextAction);
    expect(directory.baselines).toEqual(detail.baselines);
  });

  it("keeps directory and detail baseline readiness closed without a current version", () => {
    const record = projectDirectoryRecord();
    record.environments[0].currentEnvironmentVersion = null;
    record.environments[0].currentEnvironmentVersionId = null;
    const directory = present(record);
    const detail = presentProjectDeliverySummary(record, "actor-1", "ssh-v1");
    expect(directory.baselines.staging?.ready).toBe(false);
    expect(directory.baselines).toEqual(detail.baselines);
  });

  it("presents exact F415 shape and real Production evidence as online", () => {
    const item = present(projectDirectoryRecord());

    expect(item.status).toBe("online");
    expect(item.intake).toEqual({
      projectType: "web_application",
      architecture: "monorepo",
      componentCount: 1,
    });
    expect(item.baselines).toMatchObject({
      staging: { ready: true },
      production: { ready: true },
    });
    expect(item.production).toEqual({
      currentVersion: "2.3.2",
      domain: "payments.example.com",
    });
  });

  it("fails closed when the current version deployment is dry-run or mis-scoped", () => {
    const production = projectDirectoryEnvironment(
      "env-production",
      "production",
      "production",
      true,
    );
    const current = requireCurrentVersion(production);
    current.deploymentRun.dryRun = true;
    current.deploymentRun.environmentId = "other-env";

    const item = present(
      projectDirectoryRecord({
        environments: [
          projectDirectoryEnvironment("env-staging", "staging", "staging"),
          production,
        ],
      }),
    );

    expect(item.status).toBe("needs_configuration");
    expect(item.production.currentVersion).toBeNull();
  });

  it("uses only the exact active Production-scoped domain", () => {
    const item = present(
      projectDirectoryRecord({
        sites: [
          projectDirectorySite({
            id: "staging",
            primaryDomain: "staging.example.com",
            environmentId: "env-staging",
          }),
          projectDirectorySite({
            id: "pending",
            primaryDomain: "pending.example.com",
            status: "pending",
          }),
          projectDirectorySite({
            id: "production",
            primaryDomain: "prod.example.com",
          }),
        ],
      }),
    );

    expect(item.production.domain).toBe("prod.example.com");
  });

  it.each([
    ["no Site", []],
    ["inactive Site", [projectDirectorySite({ status: "pending" })]],
    ["cross-team Site", [projectDirectorySite({ teamId: "other-team" })]],
    [
      "cross-project Site",
      [projectDirectorySite({ projectId: "other-project" })],
    ],
    [
      "non-Production Site",
      [projectDirectorySite({ environmentId: "env-staging" })],
    ],
    ["blank Site domain", [projectDirectorySite({ primaryDomain: "  " })]],
  ])("keeps canonical readiness while omitting unverified directory domain for %s", (_label, sites) => {
    const item = present(projectDirectoryRecord({ sites }));

    expect(item.status).toBe("online");
    expect(item.production).toEqual({
      currentVersion: "2.3.2",
      domain: null,
    });
  });

  it("rejects a cross-team ReleaseOrder and cross-project deployment version", () => {
    const production = projectDirectoryEnvironment(
      "env-production",
      "production",
      "production",
      true,
    );
    const current = requireCurrentVersion(production);
    current.releaseOrder.teamId = "other-team";
    current.deploymentRun.projectId = "other-project";

    const item = present(
      projectDirectoryRecord({
        environments: [
          projectDirectoryEnvironment("env-staging", "staging", "staging"),
          production,
        ],
      }),
    );

    expect(item.production.currentVersion).toBeNull();
    expect(item.status).toBe("needs_configuration");
  });

  it("rejects a deployment backed by a different artifact manifest", () => {
    const production = projectDirectoryEnvironment(
      "env-production",
      "production",
      "production",
      true,
    );
    requireCurrentVersion(production).deploymentRun.artifactManifestId =
      "other-manifest";

    const item = present(
      projectDirectoryRecord({
        environments: [
          projectDirectoryEnvironment("env-staging", "staging", "staging"),
          production,
        ],
      }),
    );

    expect(item.production.currentVersion).toBeNull();
    expect(item.status).toBe("needs_configuration");
  });

  it("makes legacy intake and identity gaps explicit instead of inventing values", () => {
    const item = present(
      projectDirectoryRecord({
        repositoryIdentity: null,
        intakeFinalizations: [],
      }),
    );

    expect(item.status).toBe("needs_configuration");
    expect(item.repository).toBeNull();
    expect(item.intake).toEqual({
      projectType: null,
      architecture: null,
      componentCount: null,
    });
  });

  it("fails intake closed when the finalization result drifts from its review snapshot", () => {
    const record = projectDirectoryRecord();
    record.intakeFinalizations[0].resultSnapshot = {
      projectId: record.id,
      reviewSnapshotId: "snapshot-1",
      reviewSnapshotHash: "drifted",
    };

    expect(present(record).intake).toEqual({
      projectType: null,
      architecture: null,
      componentCount: null,
    });
  });
});

function requireCurrentVersion(
  environment: ReturnType<typeof projectDirectoryEnvironment>,
) {
  if (!environment.currentEnvironmentVersion) {
    throw new Error("fixture must contain a current environment version");
  }
  return environment.currentEnvironmentVersion;
}
