import { PrismaService } from "../prisma/prisma.service";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";

describe("ProjectRepositoryDuplicateGuardService", () => {
  it("blocks an SSH alias of another draft connection in the same team", async () => {
    const prisma = {
      projectRepositoryIdentity: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      repositoryConnection: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { repositoryUrl: "https://github.com/example/service.git" },
          ]),
      },
    } as unknown as PrismaService;
    const service = new ProjectRepositoryDuplicateGuardService(prisma);

    await expect(
      service.assertAvailable(
        "team-1",
        "project-2",
        "git@github.com:example/service.git",
      ),
    ).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_DUPLICATE" },
    });
  });

  it("scopes identity lookups to the current team and excludes the current project", async () => {
    const prisma = {
      projectRepositoryIdentity: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      repositoryConnection: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new ProjectRepositoryDuplicateGuardService(prisma);

    await service.assertAvailable(
      "team-1",
      "project-1",
      "https://git.example/repo.git",
    );

    expect(prisma.projectRepositoryIdentity.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        teamId: "team-1",
        projectId: { not: "project-1" },
      }),
      select: { id: true },
    });
  });
});
