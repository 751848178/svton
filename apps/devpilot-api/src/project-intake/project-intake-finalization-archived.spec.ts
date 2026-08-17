import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";

describe("ProjectIntakeFinalizationService archived boundary", () => {
  it("rejects before preparing a finalization record", async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          archivedAt: new Date(),
          onboardingStatus: "archived",
        }),
      },
    };
    const records = { prepare: jest.fn() };
    const executor = { execute: jest.fn() };
    const service = new ProjectIntakeFinalizationService(
      prisma as never,
      records as never,
      executor as never,
    );

    await expect(
      service.finalize("team-1", "user-1", "project-1", {
        analysisRunId: "run-1",
        reviewSnapshotId: "review-1",
        reviewSnapshotHash: "a".repeat(64),
        idempotencyKey: "finalize-1",
      }),
    ).rejects.toMatchObject({
      response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
    });
    expect(records.prepare).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
