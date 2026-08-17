import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";

describe("EnvironmentVersionReadRepository", () => {
  it("includes a succeeded ReleaseRun only when it owns a running legacy command", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new EnvironmentVersionReadRepository({
      projectEnvironment: { findMany },
    } as never);
    await repository.environments("team-1", "project-1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select:
      expect.objectContaining({ releaseRuns: expect.objectContaining({ where: { OR: [
        { status: { in: ["awaiting_approval", "running", "awaiting_validation"] } },
        { status: "succeeded", productionPromotionCommands: { some: {
          legacyReconcileRequired: true, status: "running",
        } } },
      ] } }) }),
    }));
  });
});
