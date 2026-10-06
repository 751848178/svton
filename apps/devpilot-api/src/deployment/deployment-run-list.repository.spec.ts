import type { PrismaService } from "../prisma/prisma.service";
import { listDeploymentRuns } from "./deployment-run-list.repository";

describe("listDeploymentRuns", () => {
  it("fills a page with attention runs before recent terminal runs", async () => {
    const attention = [{ id: "failed-1" }];
    const terminal = [{ id: "completed-1" }, { id: "cancelled-1" }];
    const { prisma, deploymentRun } = fakePrisma(1, [attention, terminal]);

    await expect(
      listDeploymentRuns(prisma, "team-1", {
        projectId: "project-1",
        attentionFirst: true,
        skip: 0,
        take: 3,
      }),
    ).resolves.toEqual([...attention, ...terminal]);

    expect(deploymentRun.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        skip: 0,
        take: 1,
        where: expect.objectContaining({ status: { in: expect.any(Array) } }),
      }),
    );
    expect(deploymentRun.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skip: 0,
        take: 2,
        where: expect.objectContaining({
          status: { notIn: expect.any(Array) },
        }),
      }),
    );
  });

  it("continues terminal pagination after the attention group", async () => {
    const { prisma, deploymentRun } = fakePrisma(2, [[{ id: "completed-2" }]]);
    await listDeploymentRuns(prisma, "team-1", {
      attentionFirst: true,
      skip: 3,
      take: 2,
    });
    expect(deploymentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 2,
        where: expect.objectContaining({
          status: { notIn: expect.any(Array) },
        }),
      }),
    );
  });

  it("keeps an explicit status filter ordered only by recency", async () => {
    const { prisma, deploymentRun } = fakePrisma(0, [[{ id: "failed-1" }]]);
    await listDeploymentRuns(prisma, "team-1", {
      attentionFirst: true,
      status: "failed",
    });
    expect(deploymentRun.count).not.toHaveBeenCalled();
    expect(deploymentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "failed" }),
        orderBy: { startedAt: "desc" },
      }),
    );
  });
});

function fakePrisma(count: number, pages: unknown[][]) {
  const deploymentRun = {
    count: jest.fn().mockResolvedValue(count),
    findMany: jest
      .fn()
      .mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
  };
  return {
    prisma: { deploymentRun } as unknown as PrismaService,
    deploymentRun,
  };
}
