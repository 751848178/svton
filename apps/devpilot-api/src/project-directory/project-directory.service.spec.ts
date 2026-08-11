import "reflect-metadata";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import {
  projectDirectoryEnvironment,
  projectDirectoryRecord,
} from "./project-directory.fixture";
import { ProjectDirectoryRepository } from "./project-directory.repository";
import { ProjectDirectoryService } from "./project-directory.service";
import { ConfigService } from "@nestjs/config";

function createService(records: ReturnType<typeof projectDirectoryRecord>[]) {
  const repository = {
    list: jest.fn().mockResolvedValue(records),
  } as unknown as ProjectDirectoryRepository;
  const access = {
    canRead: jest.fn().mockResolvedValue(true),
  } as unknown as ControlAccessPolicyService;
  return {
    service: new ProjectDirectoryService(repository, access, new ConfigService({
      RELEASE_STAGING_DEPLOYMENT_ENABLED: true,
      RELEASE_DEPLOYMENT_PROVIDER_PROFILE: "ssh-v1",
    })),
    repository,
    access,
  };
}

describe("project directory service", () => {
  it("keeps summary authorization-safe before applying the one status filter", async () => {
    const needsConfiguration = projectDirectoryRecord({
      id: "project-needs-config",
      name: "Worker",
      environments: [
        projectDirectoryEnvironment("env-staging", "staging", "staging"),
      ],
    });
    const { service, repository, access } = createService([
      projectDirectoryRecord({ id: "project-online" }),
      needsConfiguration,
      projectDirectoryRecord({ id: "project-denied" }),
    ]);
    jest
      .mocked(access.canRead)
      .mockImplementation(({ projectId }) =>
        Promise.resolve(projectId !== "project-denied"),
      );
    const query = Object.assign(new ProjectDirectoryQueryDto(), {
      status: "needs_configuration" as const,
      take: 20,
    });

    await expect(
      service.list("team-1", "user-1", query),
    ).resolves.toMatchObject({
      scope: { teamId: "team-1", actorId: "user-1" },
      items: [{ id: "project-needs-config" }],
      total: 1,
      summary: { total: 2, online: 1, needsConfiguration: 1 },
    });
    expect(repository.list).toHaveBeenCalledWith("team-1");
  });

  it.each([
    ["name", "payments"],
    ["repository", "github.com/example/payments"],
    ["domain", "payments.example.com"],
  ])("searches by %s on the server", async (_label, query) => {
    const other = projectDirectoryRecord({
      id: "project-other",
      name: "Other",
    });
    other.repositoryIdentity!.canonicalKey = "github.com/example/other";
    other.repositoryIdentity!.canonicalUrl = "https://github.com/example/other";
    other.repositoryConnection!.repositoryUrl =
      "git@github.com:example/other.git";
    other.sites[0].primaryDomain = "other.example.com";
    const { service } = createService([
      projectDirectoryRecord({ id: "project-match" }),
      other,
    ]);
    const input = Object.assign(new ProjectDirectoryQueryDto(), { query });

    const result = await service.list("team-1", "user-1", input);

    expect(result.items.map(({ id }) => id)).toEqual(["project-match"]);
  });

  it("sorts by persisted activity with an id tie-break after authorization", async () => {
    const at = new Date("2026-08-03T05:00:00.000Z");
    const record = (id: string) =>
      projectDirectoryRecord({
        id,
        updatedAt: at,
        repositoryIdentity: null,
      });
    const { service, access } = createService([
      record("project-b"),
      record("project-denied"),
      record("project-a"),
    ]);
    jest
      .mocked(access.canRead)
      .mockImplementation(({ projectId }) =>
        Promise.resolve(projectId !== "project-denied"),
      );

    const result = await service.list(
      "team-1",
      "user-1",
      new ProjectDirectoryQueryDto(),
    );

    expect(result.items.map(({ id }) => id)).toEqual([
      "project-a",
      "project-b",
    ]);
  });
});
