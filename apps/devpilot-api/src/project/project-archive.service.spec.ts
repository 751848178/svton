import { ProjectArchiveService } from "./project-archive.service";

describe("ProjectArchiveService", () => {
  it("archives mutable project records without deleting historical data", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "project-1" }]),
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1", name: "Legacy", archivedAt: null,
        }),
        update: jest.fn(),
      },
      projectEnvironment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      application: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      applicationService: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      repositoryAnalysisRun: { findFirst: jest.fn().mockResolvedValue(null) },
      projectIntakeFinalization: { findFirst: jest.fn().mockResolvedValue(null) },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work) => work(tx)) };
    const result = await new ProjectArchiveService(prisma as never)
      .archive("team-1", "user-1", "project-1");
    expect(result).toMatchObject({
      success: true,
      alreadyArchived: false,
      preserved: { environments: 2, applications: 1, services: 3 },
    });
    expect(tx.project.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ onboardingStatus: "archived" }),
    }));
    expect(tx.auditEvent.create).toHaveBeenCalled();
    expect((tx as { project?: { delete?: unknown } }).project?.delete).toBeUndefined();
  });

  it("rejects archive before mutating when repository analysis is active", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "project-1" }]),
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1", name: "Active", archivedAt: null,
        }),
        update: jest.fn(),
      },
      repositoryAnalysisRun: {
        findFirst: jest.fn().mockResolvedValue({ id: "run-active" }),
      },
      projectIntakeFinalization: { findFirst: jest.fn() },
      projectEnvironment: { updateMany: jest.fn() },
      application: { updateMany: jest.fn() },
      applicationService: { updateMany: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work) => work(tx)) };

    await expect(new ProjectArchiveService(prisma as never)
      .archive("team-1", "user-1", "project-1"))
      .rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVE_REPOSITORY_ANALYSIS_ACTIVE" },
      });
    expect(tx.project.update).not.toHaveBeenCalled();
    expect(tx.projectEnvironment.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects archive while intake finalization is pending", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "project-1" }]),
      project: { findFirst: jest.fn().mockResolvedValue({
        id: "project-1", name: "Pending", archivedAt: null,
      }), update: jest.fn() },
      repositoryAnalysisRun: { findFirst: jest.fn().mockResolvedValue(null) },
      projectIntakeFinalization: {
        findFirst: jest.fn().mockResolvedValue({ id: "finalization-1" }),
      },
      projectEnvironment: { updateMany: jest.fn() },
      application: { updateMany: jest.fn() },
      applicationService: { updateMany: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work) => work(tx)) };

    await expect(new ProjectArchiveService(prisma as never)
      .archive("team-1", "user-1", "project-1"))
      .rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVE_FINALIZATION_ACTIVE" },
      });
    expect(tx.project.update).not.toHaveBeenCalled();
    expect(tx.projectEnvironment.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
