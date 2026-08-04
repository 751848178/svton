import "reflect-metadata";
import {
  projectDirectoryEnvironment,
  projectDirectoryRecord,
  projectDirectorySite,
} from "./project-directory.fixture";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";

describe("project directory presenter", () => {
  it("presents exact F415 shape and real Production evidence as online", () => {
    const item = toProjectDirectoryItem(projectDirectoryRecord());

    expect(item.status).toBe("online");
    expect(item.intake).toEqual({
      projectType: "web_application",
      architecture: "monorepo",
      componentCount: 2,
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
    production.currentEnvironmentVersion!.deploymentRun.dryRun = true;
    production.currentEnvironmentVersion!.deploymentRun.environmentId =
      "other-env";

    const item = toProjectDirectoryItem(
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
    const item = toProjectDirectoryItem(
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
  ])("fails online closed for %s", (_label, sites) => {
    const item = toProjectDirectoryItem(projectDirectoryRecord({ sites }));

    expect(item.status).toBe("needs_configuration");
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
    production.currentEnvironmentVersion!.releaseOrder.teamId = "other-team";
    production.currentEnvironmentVersion!.deploymentRun.projectId =
      "other-project";

    const item = toProjectDirectoryItem(
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
    production.currentEnvironmentVersion!.deploymentRun.artifactManifestId =
      "other-manifest";

    const item = toProjectDirectoryItem(
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
    const item = toProjectDirectoryItem(
      projectDirectoryRecord({
        config: {},
        repositoryIdentity: null,
        repositoryIntakeReviewSnapshots: [],
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
});
