import "reflect-metadata";
import {
  projectDirectoryEnvironment,
  projectDirectoryRecord,
} from "./project-directory.fixture";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";

describe("project directory presenter", () => {
  it("derives ready baselines, exact Production and deduplicated domain summaries", () => {
    const item = toProjectDirectoryItem(projectDirectoryRecord());

    expect(item.configurationStatus).toBe("ready");
    expect(item.runtimeStatus).toBe("idle");
    expect(item.production).toMatchObject({
      environmentId: "env-production",
      latestDeployment: { id: "deployment-1", dryRun: false },
      currentVersion: null,
    });
    expect(item.domains).toEqual([
      { domain: "payments.example.com", status: "active", source: "site" },
    ]);
  });

  it("reports running and configuration gaps from project-scoped relations", () => {
    const item = toProjectDirectoryItem(
      projectDirectoryRecord({
        onboardingStatus: "ready",
        environments: [
          projectDirectoryEnvironment("env-staging", "staging", "staging"),
        ],
        repositoryAnalysisRuns: [
          {
            id: "run-1",
            status: "running",
            createdAt: new Date("2026-08-03T03:00:00.000Z"),
            finishedAt: null,
          },
        ],
      }),
    );

    expect(item.runtimeStatus).toBe("running");
    expect(item.configurationStatus).toBe("needs_configuration");
    expect(item.production).toBeNull();
  });

  it("does not let an older failed run override the latest successful run", () => {
    const item = toProjectDirectoryItem(
      projectDirectoryRecord({
        repositoryAnalysisRuns: [
          {
            id: "run-latest",
            status: "succeeded",
            createdAt: new Date("2026-08-03T04:00:00.000Z"),
            finishedAt: new Date("2026-08-03T04:01:00.000Z"),
          },
          {
            id: "run-old",
            status: "failed",
            createdAt: new Date("2026-08-03T03:00:00.000Z"),
            finishedAt: new Date("2026-08-03T03:01:00.000Z"),
          },
        ],
      }),
    );

    expect(item.runtimeStatus).toBe("idle");
  });

  it("fails closed for a READY legacy project without an identity revision", () => {
    const item = toProjectDirectoryItem(projectDirectoryRecord({
      onboardingStatus: "ready",
      repositoryIdentity: null,
    }));

    expect(item.repository).toMatchObject({
      canonicalUrl: null,
      defaultBranch: null,
      identityRevisionId: null,
      identityRevision: null,
      commitSha: null,
      status: "identity_migration_required",
    });
  });
});
