import { ProjectArchiveService } from "./project-archive.service";

describe("ProjectArchiveService", () => {
  it("archives mutable project records without deleting historical data", async () => {
    const tx = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1", name: "Legacy", archivedAt: null,
        }),
        update: jest.fn(),
      },
      projectEnvironment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      application: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      applicationService: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
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
});
