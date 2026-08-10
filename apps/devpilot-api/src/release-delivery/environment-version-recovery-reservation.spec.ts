import { assertRecoveryReservationAvailable } from "./environment-version-recovery.repository";

describe("Production recovery reservation guard", () => {
  it("rejects compensation_required before ReleaseRun or approval side effects", async () => {
    const order: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => order.push("environment_lock")),
      siteRouteSwitchRun: {
        findFirst: jest.fn(async () => {
          order.push("route_saga_guard");
          return {
            operationId: "operation-1",
            status: "compensation_required",
          };
        }),
      },
      releaseRun: {
        findFirst: jest.fn(async () => {
          order.push("release_run_guard");
          return null;
        }),
        create: jest.fn(),
      },
      operationApproval: { create: jest.fn() },
    };

    await expect(
      assertRecoveryReservationAvailable(tx as never, {
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "production-1",
      }),
    ).rejects.toThrow("compensation_required");

    expect(order).toEqual(["environment_lock", "route_saga_guard"]);
    expect(tx.releaseRun.create).not.toHaveBeenCalled();
    expect(tx.operationApproval.create).not.toHaveBeenCalled();
  });
});
