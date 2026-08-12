import { ReleaseProductionPreflightController } from "./release-production-preflight.controller";

describe("ReleaseProductionPreflightController", () => {
  it("requires Production confirmation permission before refreshing evidence", async () => {
    const production = { refreshPreflight: jest.fn().mockResolvedValue({}) };
    const access = { assertConfirmProduction: jest.fn().mockResolvedValue(undefined) };
    const controller = new ReleaseProductionPreflightController(
      production as never,
      access as never,
    );
    await controller.refresh(
      { teamId: "team-1", user: { id: "actor-1" } },
      "project-1",
      "order-1",
      { manifestId: "manifest-1" },
    );
    expect(access.assertConfirmProduction).toHaveBeenCalledWith({
      teamId: "team-1", actorId: "actor-1", projectId: "project-1",
    });
    expect(production.refreshPreflight).toHaveBeenCalledWith(
      "team-1", "project-1", "order-1", "manifest-1", "actor-1", undefined,
    );
  });
});
