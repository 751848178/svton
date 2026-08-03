import "reflect-metadata";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { projectDirectoryRecord } from "./project-directory.fixture";
import { ProjectDirectoryRepository } from "./project-directory.repository";
import { ProjectDirectoryService } from "./project-directory.service";

function createService(records: ReturnType<typeof projectDirectoryRecord>[]) {
  const repository = {
    list: jest.fn().mockResolvedValue(records),
  } as unknown as ProjectDirectoryRepository;
  const access = {
    canRead: jest.fn().mockResolvedValue(true),
  } as unknown as ControlAccessPolicyService;
  return { service: new ProjectDirectoryService(repository, access), repository, access };
}

describe("project directory service", () => {
  it("filters denied projects before applying runtime/configuration filters", async () => {
    const { service, repository, access } = createService([
      projectDirectoryRecord({ id: "project-allowed" }),
      projectDirectoryRecord({ id: "project-denied" }),
    ]);
    jest
      .mocked(access.canRead)
      .mockImplementation(({ projectId }) =>
        Promise.resolve(projectId === "project-allowed"),
      );
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
    const { service } = createService([
      projectDirectoryRecord({
        id: "project-stale",
        updatedAt: new Date("2026-08-03T04:00:00.000Z"),
      }),
      projectDirectoryRecord({
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
    ]);

    const result = await service.list(
      "team-1",
      "user-1",
      new ProjectDirectoryQueryDto(),
    );

    expect(result.items.map(({ id }) => id)).toEqual([
      "project-active",
      "project-stale",
    ]);
  });
});
