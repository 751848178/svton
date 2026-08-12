import {
  assertNoActiveProductionRouteSaga,
  lockAndAssertNoActiveProductionRouteSaga,
} from "./production-route-saga.guard";

describe("ProductionRouteSagaGuard", () => {
  const scope = {
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "production-1",
  };

  it("blocks compensation_required using the exact environment scope", async () => {
    const client = {
      siteRouteSwitchRun: {
        findFirst: jest.fn().mockResolvedValue({
          operationId: "operation-1",
          status: "compensation_required",
        }),
      },
    };

    await expect(
      assertNoActiveProductionRouteSaga(client as never, {
        ...scope, kind: "upgrade",
      } as never),
    ).rejects.toThrow("compensation_required");
    expect(client.siteRouteSwitchRun.findFirst).toHaveBeenCalledWith(
      { where: { ...scope, status: { in: expect.any(Array) } },
        select: { operationId: true, status: true } },
    );
  });

  it("locks the environment row before the reservation CAS guard", async () => {
    const order: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => order.push("lock")),
      siteRouteSwitchRun: {
        findFirst: jest.fn(async () => {
          order.push("guard");
          return null;
        }),
      },
    };

    await lockAndAssertNoActiveProductionRouteSaga(tx as never, scope);

    expect(order).toEqual(["lock", "guard"]);
  });
});
