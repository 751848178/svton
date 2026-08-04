import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseOrderListRepository } from "./release-order-list.repository";

describe("ReleaseOrderListRepository", () => {
  it("normalizes MySQL rows inside one repeatable-read snapshot", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ total: 7n }])
      .mockResolvedValueOnce([row()]);
    const prisma = {
      $transaction: jest.fn((work) => work({ $queryRaw: queryRaw })),
    } as unknown as PrismaService;
    const repository = new ReleaseOrderListRepository(prisma);

    const result = await repository.list({
      teamId: "team-1",
      projectId: "project-1",
      take: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(7);
    expect(result.items).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ commitSha: "abc123" }),
        build: expect.objectContaining({ count: 3 }),
        deployment: expect.objectContaining({ count: 2 }),
        lastExecution: expect.objectContaining({
          step: "production",
          status: "awaiting_approval",
        }),
      }),
    ]);
  });

  it("rejects unsafe MySQL count coercion", async () => {
    const prisma = {
      $transaction: jest.fn((work) =>
        work({
          $queryRaw: jest
            .fn()
            .mockResolvedValueOnce([
              { total: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
            ])
            .mockResolvedValueOnce([]),
        }),
      ),
    } as unknown as PrismaService;
    await expect(
      new ReleaseOrderListRepository(prisma).list({
        teamId: "team-1",
        projectId: "project-1",
        take: 50,
      }),
    ).rejects.toThrow("safe integer");
  });
});

function row() {
  const occurredAt = new Date("2026-08-04T08:00:00.000Z");
  return {
    id: "order-1",
    projectId: "project-1",
    releaseVersion: "2.4.1",
    note: "Release note",
    status: "active",
    createdAt: new Date("2026-08-04T01:00:00.000Z"),
    sourceBranch: "main",
    sourceCommitSha: "abc123",
    buildRunId: "build-3",
    buildRevision: 3,
    buildStatus: "failed",
    buildCount: 3n,
    manifestId: "manifest-2",
    manifestDigest: "sha256:manifest",
    manifestBuildRunId: "build-2",
    manifestBuildRevision: 2,
    manifestCreatedAt: new Date("2026-08-04T05:00:00.000Z"),
    deploymentCount: 2n,
    deploymentId: "deployment-2",
    environmentId: "staging",
    environmentRole: "staging",
    environmentName: "Staging",
    deploymentStatus: "completed",
    artifactManifestId: "manifest-2",
    deploymentBuildRunId: "build-2",
    deploymentOccurredAt: new Date("2026-08-04T06:00:00.000Z"),
    sourceType: "release_run",
    sourceId: "release-run-1",
    step: "production",
    executionStatus: "awaiting_approval",
    lastExecutedAt: occurredAt,
  };
}
