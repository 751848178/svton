import "reflect-metadata";
import {
  projectDirectoryEnvironment,
  projectDirectoryRecord,
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
          {
            id: "staging",
            primaryDomain: "staging.example.com",
            status: "active",
            environmentId: "env-staging",
          },
          {
            id: "pending",
            primaryDomain: "pending.example.com",
            status: "pending",
            environmentId: "env-production",
          },
          {
            id: "production",
            primaryDomain: "prod.example.com",
            status: "active",
            environmentId: "env-production",
          },
        ],
      }),
    );

    expect(item.production.domain).toBe("prod.example.com");
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
