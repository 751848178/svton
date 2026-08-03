import { ProjectIntakeBaselineFinalizerService } from "./project-intake-baseline-finalizer.service";

describe("ProjectIntakeBaselineFinalizerService", () => {
  it("leaves a new baseline key mutable until its first deployment", async () => {
    const tx = {
      projectEnvironment: {
        upsert: jest.fn(({ create }) => Promise.resolve({
          id: `env-${create.baselineRole}`,
          currentConfigRevisionId: null,
        })),
        update: jest.fn().mockResolvedValue({}),
      },
      environmentConfigRevision: {
        upsert: jest.fn(({ create }) => Promise.resolve({ id: `revision-${create.environmentId}` })),
      },
    };
    const service = new ProjectIntakeBaselineFinalizerService();
    await service.ensure(tx as never, {
      teamId: "team-1", projectId: "project-1", actorId: "user-1",
    } as never);

    expect(tx.projectEnvironment.upsert).toHaveBeenCalledTimes(2);
    for (const [input] of tx.projectEnvironment.upsert.mock.calls) {
      expect(input.create.identityLockedAt).toBeUndefined();
      expect(input.update.identityLockedAt).toBeUndefined();
    }
  });
});
