import "reflect-metadata";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";
import {
  ProjectDirectoryRecord,
  ProjectDirectoryRepository,
} from "./project-directory.repository";
import { ProjectDirectoryService } from "./project-directory.service";

function record(
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
      provider: "github",
      canonicalUrl: "https://github.com/example/payments",
      defaultBranch: "main",
    },
    repositoryConnection: {
      provider: "github",
      defaultBranch: "main",
      selectedBranch: "main",
      commitSha: "a".repeat(40),
      status: "connected",
    },
    environments: [
      environment("env-staging", "staging", "staging"),
      environment("env-production", "production", "production", [
        {
          id: "deployment-1",
          status: "completed",
          dryRun: false,
          commitSha: "a".repeat(40),
          startedAt: new Date("2026-08-03T02:00:00.000Z"),
          finishedAt: new Date("2026-08-03T02:01:00.000Z"),
        },
      ]),
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

function environment(
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

describe("project directory read model", () => {
  it("derives ready baselines, exact Production and deduplicated domain summaries", () => {
    const item = toProjectDirectoryItem(record());

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
      record({
        onboardingStatus: "ready",
        environments: [environment("env-staging", "staging", "staging")],
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

  it("filters denied projects before applying runtime/configuration filters", async () => {
    const repository = {
      list: jest
        .fn()
        .mockResolvedValue([
          record({ id: "project-allowed" }),
          record({ id: "project-denied" }),
        ]),
    } as unknown as ProjectDirectoryRepository;
    const access = {
      canRead: jest.fn(({ projectId }) =>
        Promise.resolve(projectId === "project-allowed"),
      ),
    } as unknown as ControlAccessPolicyService;
    const service = new ProjectDirectoryService(repository, access);
    const query = Object.assign(new ProjectDirectoryQueryDto(), {
      search: "pay",
      configurationStatus: "ready" as const,
      take: 20,
    });

    await expect(
      service.list("team-1", "user-1", query),
    ).resolves.toMatchObject({
      items: [{ id: "project-allowed" }],
      total: 1,
      summary: { total: 1, online: 1, needsConfiguration: 0 },
    });
    expect(repository.list).toHaveBeenCalledWith("team-1", "pay");
    expect(access.canRead).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        actorId: "user-1",
        projectId: "project-denied",
        action: "project.read",
      }),
    );
  });

  it("sorts visible projects by latest activity instead of repository order", async () => {
    const repository = {
      list: jest.fn().mockResolvedValue([
        record({
          id: "project-stale",
          updatedAt: new Date("2026-08-03T04:00:00.000Z"),
        }),
        record({
          id: "project-active",
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          auditEvents: [
            {
              id: "audit-recent",
              action: "project.updated",
              status: "succeeded",
              summary: "recent",
              occurredAt: new Date("2026-08-03T05:00:00.000Z"),
            },
          ],
        }),
      ]),
    } as unknown as ProjectDirectoryRepository;
    const access = {
      canRead: jest.fn().mockResolvedValue(true),
    } as unknown as ControlAccessPolicyService;
    const service = new ProjectDirectoryService(repository, access);

    const result = await service.list(
      "team-1",
      "user-1",
      new ProjectDirectoryQueryDto(),
    );

    expect(result.items.map((project) => project.id)).toEqual([
      "project-active",
      "project-stale",
    ]);
  });
});
