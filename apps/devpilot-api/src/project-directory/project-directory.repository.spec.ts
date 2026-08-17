import { PrismaService } from "../prisma/prisma.service";
import { ProjectDirectoryRepository } from "./project-directory.repository";

describe("ProjectDirectoryRepository", () => {
  it("scopes the root query and selects exact relation-backed directory evidence", async () => {
    const prisma = {
      project: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const repository = new ProjectDirectoryRepository(prisma);

    await repository.list("team-1");

    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    const query = (prisma.project.findMany as jest.Mock).mock.calls[0][0];
    expect(query.where).toEqual({ teamId: "team-1", archivedAt: null });
    expect(query.orderBy).toEqual([{ id: "asc" }]);
    expect(query.select.intakeFinalizations).toMatchObject({
      where: { status: "succeeded" },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: 1,
      select: {
        finishedAt: true,
        resultSnapshot: true,
        analysisRun: {
          select: {
            teamId: true,
            projectId: true,
            status: true,
            intakeReviewSnapshot: {
              select: expect.objectContaining({
                id: true,
                teamId: true,
                projectId: true,
                snapshotHash: true,
                decisions: true,
              }),
            },
          },
        },
      },
    });
    expect(query.select).not.toHaveProperty("config");
    expect(
      query.select.environments.select.currentEnvironmentVersion.select,
    ).toMatchObject({
      releaseOrderId: true,
      artifactManifestId: true,
      releaseOrder: { select: { id: true, releaseVersion: true } },
      artifactManifest: {
        select: {
          id: true,
          teamId: true,
          projectId: true,
          releaseOrderId: true,
        },
      },
      deploymentRun: {
        select: expect.objectContaining({
          environmentId: true,
          artifactManifestId: true,
          dryRun: true,
        }),
      },
    });
    expect(query.select.sites).toMatchObject({
      select: { teamId: true, projectId: true, environmentId: true },
    });
    expect(JSON.stringify(query.select)).not.toContain('logs"');
    const activityQuery = (prisma.$queryRaw as jest.Mock).mock.calls[0][0] as {
      strings: string[];
    };
    const sql = activityQuery.strings.join(" ");
    expect(sql).toContain("ROW_NUMBER() OVER");
    expect(sql).toContain("COALESCE(finishedAt, createdAt)");
    expect(sql).toContain("ORDER BY occurredAt DESC, id ASC, activityType ASC");
  });
});
