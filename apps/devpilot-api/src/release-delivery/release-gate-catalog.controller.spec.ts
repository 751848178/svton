import { ReleaseGateCatalogController } from "./release-gate-catalog.controller";

describe("ReleaseGateCatalogController manual permission", () => {
  it.each([
    ["build", "assertBuild", "assertConfirmProduction"],
    ["production", "assertConfirmProduction", "assertBuild"],
  ] as const)("maps persisted %s stage to the exact permission", async (
    permission,
    allowed,
    denied,
  ) => {
    const access = {
      assertBuild: jest.fn(),
      assertConfirmProduction: jest.fn(),
    };
    const confirmations = {
      resolve: jest.fn().mockResolvedValue({ permission }),
      confirm: jest.fn().mockResolvedValue({ id: "evaluation-1" }),
    };
    const controller = new ReleaseGateCatalogController(
      {} as never,
      access as never,
      confirmations as never,
    );
    await controller.confirm(
      { teamId: "team-1", user: { id: "actor-1" } },
      "project-1",
      "order-1",
      permission === "build" ? "C06" : "P03",
      "evaluation-1",
      { reason: "reviewed exact evidence" },
    );
    expect(access[allowed]).toHaveBeenCalled();
    expect(access[denied]).not.toHaveBeenCalled();
    expect(confirmations.resolve.mock.invocationCallOrder[0])
      .toBeLessThan(access[allowed].mock.invocationCallOrder[0]);
  });
});
