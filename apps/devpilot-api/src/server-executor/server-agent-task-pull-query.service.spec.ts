import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";

describe("ServerAgentTaskPullQueryService", () => {
  it("claims ready jobs by priority first and queued time second", async () => {
    const now = new Date("2026-07-12T14:00:00.000Z");
    const job = buildJob("job-high");
    const prisma = buildPrisma({
      findFirst: jest.fn().mockResolvedValue(job),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(job),
    });
    const service = new ServerAgentTaskPullQueryService(prisma);

    await service.claimNextReadyJob(
      { teamId: "team-1", serverId: "server-1", transport: "server_agent" },
      now,
      "server-agent:agent-1:runner-1",
      new Date("2026-07-12T14:02:00.000Z"),
    );

    expect(prisma.serverExecutionJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
          status: "queued",
          queueMode: "queued",
          availableAt: { lte: now },
        }),
        orderBy: [{ priority: "desc" }, { queuedAt: "asc" }],
      }),
    );
  });

  it("returns no claim when another runner wins the queued job race", async () => {
    const now = new Date("2026-07-12T14:00:00.000Z");
    const prisma = buildPrisma({
      findFirst: jest.fn().mockResolvedValue(buildJob("job-raced")),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
    });
    const service = new ServerAgentTaskPullQueryService(prisma);

    await expect(
      service.claimNextReadyJob(
        {
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
        },
        now,
        "server-agent:agent-1:runner-1",
        new Date("2026-07-12T14:02:00.000Z"),
      ),
    ).resolves.toBeNull();
    expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
  });
});

function buildPrisma(serverExecutionJob: {
  findFirst: jest.Mock;
  updateMany: jest.Mock;
  findUnique: jest.Mock;
}) {
  return { serverExecutionJob } as unknown as PrismaService & {
    serverExecutionJob: typeof serverExecutionJob;
  };
}

function buildJob(id: string) {
  return {
    id,
    operationKey: "deployment.run",
    adapterKey: "server-agent",
    serverId: "server-1",
    priority: 10,
    queuedAt: new Date("2026-07-12T13:58:00.000Z"),
    availableAt: new Date("2026-07-12T13:59:00.000Z"),
    inputSnapshot: {
      operationKey: "deployment.run",
      adapterKey: "server-agent",
      target: { transport: "server_agent", serverId: "server-1" },
      steps: [],
    },
  };
}
