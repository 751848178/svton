import { OperationApprovalController } from "./operation-approval.controller";

const req = {
  teamId: "team-1",
  user: { id: "user-1" },
};

describe("OperationApprovalController", () => {
  it("guards the review route to team admins so a non-admin review is forbidden", () => {
    const roles = Reflect.getMetadata(
      "roles",
      OperationApprovalController.prototype.review,
    );
    expect(roles).toEqual(["team_admin"]);
    expect(Reflect.getMetadata("roles", OperationApprovalController)).toEqual([
      "team_member",
    ]);
  });

  it("delegates review to the service with the acting reviewer", async () => {
    const approvalService = {
      list: jest.fn(),
      review: jest
        .fn()
        .mockResolvedValue({ id: "approval-1", status: "approved" }),
    };
    const controller = new OperationApprovalController(
      approvalService as any,
      { canRead: jest.fn() } as any,
    );
    const dto = { decision: "approved", reviewComment: "ok" };

    await expect(
      controller.review(req as any, "approval-1", dto as any),
    ).resolves.toEqual({ id: "approval-1", status: "approved" });
    expect(approvalService.review).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "approval-1",
      dto,
    );
  });

  it("filters listed approvals through control_read using approval risk", async () => {
    const approvals = [
      {
        id: "approval-visible",
        projectId: "project-1",
        environmentId: "env-1",
        risk: "high",
      },
      {
        id: "approval-hidden",
        projectId: "project-2",
        environmentId: "env-2",
        risk: "medium",
      },
    ];
    const approvalService = {
      list: jest.fn().mockResolvedValue(approvals),
      review: jest.fn(),
    };
    const accessPolicyService = {
      canRead: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const controller = new OperationApprovalController(
      approvalService as any,
      accessPolicyService as any,
    );

    await expect(
      controller.list(req as any, { status: "pending" } as any),
    ).resolves.toEqual([approvals[0]]);

    expect(approvalService.list).toHaveBeenCalledWith("team-1", {
      status: "pending",
    });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(1, {
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      environmentId: "env-1",
      category: "approval",
      action: "operation_approval.read",
      targetType: "operation_approval",
      targetId: "approval-visible",
      risk: "high",
    });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectId: "project-2",
        environmentId: "env-2",
        targetId: "approval-hidden",
        risk: "medium",
      }),
    );
  });
});
