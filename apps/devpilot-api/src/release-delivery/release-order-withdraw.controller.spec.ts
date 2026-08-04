import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderWithdrawController } from "./release-order-withdraw.controller";
import { ReleaseOrderWithdrawService } from "./release-order-withdraw.service";

describe("ReleaseOrderWithdrawController", () => {
  it("uses the dedicated high-risk project.release_order.withdraw permission", async () => {
    const policies = {
      assertCanWrite: jest.fn().mockResolvedValue(undefined),
    } as unknown as ControlAccessPolicyService;
    const access = new ReleaseOrderAccessService(policies);
    await access.assertWithdraw({
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
    });
    expect(policies.assertCanWrite).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
      category: "release",
      action: "project.release_order.withdraw",
      targetType: "project",
      targetId: "project-1",
      risk: "high",
    });
  });

  it("enforces the exact withdrawal ACL before invoking the command", async () => {
    const events: string[] = [];
    const access = {
      assertWithdraw: jest.fn(async () => events.push("acl")),
    } as unknown as ReleaseOrderAccessService;
    const withdrawals = {
      withdraw: jest.fn(async () => {
        events.push("withdraw");
        return {
          persistedStatus: "canceled",
          lifecycle: { status: "withdrawn" },
        };
      }),
    } as unknown as ReleaseOrderWithdrawService;
    const controller = new ReleaseOrderWithdrawController(withdrawals, access);

    await expect(
      controller.withdraw(
        { teamId: "team-1", user: { id: "actor-1" } },
        "project-1",
        "order-1",
      ),
    ).resolves.toMatchObject({ persistedStatus: "canceled" });
    expect(events).toEqual(["acl", "withdraw"]);
    expect(access.assertWithdraw).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
    });
    expect(withdrawals.withdraw).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
    });
  });
});
import { ControlAccessPolicyService } from "../control-access-policy";
