import { PrismaService } from "../prisma/prisma.service";
import { ProjectDeliverySummaryRepository } from "./project-delivery-summary.repository";

describe("ProjectDeliverySummaryRepository", () => {
  it("scopes the root query and selects only F418 relation evidence", async () => {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const repository = new ProjectDeliverySummaryRepository(prisma);

    await repository.load("team-1", "project-1");

    const query = (prisma.project.findFirst as jest.Mock).mock.calls[0][0];
    expect(query.where).toEqual({
      id: "project-1",
      teamId: "team-1",
      archivedAt: null,
    });
    expect(query.select.repositoryIdentity.select).not.toHaveProperty(
      "defaultBranch",
    );
    expect(
      query.select.repositoryIdentity.select.currentRevision.select,
    ).toHaveProperty("defaultBranch", true);
    expect(
      query.select.environments.select.currentEnvironmentVersion.select,
    ).toMatchObject({ deploymentRunId: true, artifactManifestId: true });
    expect(query.select.sites.select).toMatchObject({
      teamId: true,
      projectId: true,
      environmentId: true,
      status: true,
    });
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
              select: expect.objectContaining({ snapshotHash: true }),
            },
          },
        },
      },
    });
    expect(query.select).not.toHaveProperty("config");
    const serialized = JSON.stringify(query.select);
    expect(serialized).not.toContain('"gitRepo"');
    expect(serialized).not.toContain('"logs"');
  });
});
