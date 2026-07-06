import { PrismaService } from "../prisma/prisma.service";
import { LogRunQueryService } from "./log-run-query.service";

describe("LogRunQueryService", () => {
  let prisma: {
    logCollectionRun: { findMany: jest.Mock };
    logRetentionRun: { findMany: jest.Mock };
  };
  let service: LogRunQueryService;

  beforeEach(() => {
    prisma = {
      logCollectionRun: { findMany: jest.fn().mockResolvedValue([]) },
      logRetentionRun: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new LogRunQueryService(prisma as unknown as PrismaService);
  });

  it("lists collection runs with scoped filters and the stable limit", async () => {
    await service.listCollectionRuns("team-1", {
      streamId: "stream-1",
      sourceType: "docker",
      status: "completed",
      projectId: "project-1",
      environmentId: "env-1",
    });

    expect(prisma.logCollectionRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: "team-1",
        streamId: "stream-1",
        sourceType: "docker",
        status: "completed",
        projectId: "project-1",
        environmentId: "env-1",
      },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: expect.any(Object),
    });
  });

  it("lists retention runs with dry-run filtering and the stable limit", async () => {
    await service.listRetentionRuns("team-1", {
      streamId: "stream-1",
      status: "completed",
      dryRun: false,
      projectId: "project-1",
      environmentId: "env-1",
    });

    expect(prisma.logRetentionRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: "team-1",
        streamId: "stream-1",
        status: "completed",
        dryRun: false,
        projectId: "project-1",
        environmentId: "env-1",
      },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: expect.any(Object),
    });
  });
});
