import { BadRequestException } from "@nestjs/common";
import { OperationApprovalService } from "./operation-approval.service";

describe("OperationApprovalService", () => {
  const approvalRepository = {
    list: jest.fn(),
    findReusablePending: jest.fn(),
    create: jest.fn(),
    findByIdForTeam: jest.fn(),
    reviewPending: jest.fn(),
    consume: jest.fn(),
  };
  const approvalMatchService = { assertMatches: jest.fn() };
  const approvalAuditService = { writeApprovalAudit: jest.fn() };
  const approvalRequirementService = { evaluate: jest.fn() };
  const accessPolicyService = {
    assertCanRequestApproval: jest.fn(),
    assertCanReviewApproval: jest.fn(),
    assertCanExecuteApproved: jest.fn(),
  };
  // F470：review 现委托给 OperationApprovalReviewService（CAS + 交互式事务）。
  const reviewService = { review: jest.fn() };
  const service = new OperationApprovalService(
    approvalRepository as any,
    approvalMatchService as any,
    approvalAuditService as any,
    approvalRequirementService as any,
    accessPolicyService as any,
    reviewService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds approval requirement metadata when creating a new pending approval", async () => {
    const approvalRequirement = {
      required: true,
      resourceType: "managed_resource",
      operationType: "resource.action.restart",
      environmentId: "env-prod",
    };
    approvalRepository.findReusablePending.mockResolvedValue(null);
    approvalRequirementService.evaluate.mockResolvedValue(approvalRequirement);
    approvalRepository.create.mockImplementation(async (input) => ({
      id: "approval-1",
      teamId: input.teamId,
      requesterId: input.requesterId,
      reviewerId: null,
      projectId: input.projectId,
      environmentId: input.environmentId,
      applicationId: null,
      applicationServiceId: null,
      serverId: null,
      siteId: null,
      managedResourceId: null,
      category: input.category,
      action: input.action,
      targetType: input.targetType,
      targetId: null,
      risk: input.risk,
      status: "pending",
      summary: null,
      reviewComment: null,
      metadata: input.metadata,
    }));

    await service.createPending({
      teamId: "team-1",
      requesterId: "user-1",
      projectId: "project-1",
      environmentId: "env-prod",
      category: "resource_action",
      action: "resource.action.restart",
      targetType: "managed_resource",
      risk: "high",
      metadata: { resourceActionRunId: "run-1" },
    });

    expect(approvalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          resourceActionRunId: "run-1",
          approvalRequirement,
        },
      }),
    );
    expect(approvalAuditService.writeApprovalAudit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "approval-1" }),
      "approval.requested",
      "pending",
    );
  });

  // F470：review 是薄 facade，参数契约不变，全部委托给 OperationApprovalReviewService。
  it("delegates review to OperationApprovalReviewService with unchanged arguments", async () => {
    const reviewed = { id: "approval-1", status: "approved", reviewerId: "reviewer-1" };
    reviewService.review.mockResolvedValue(reviewed);

    const result = await service.review(
      "team-1",
      "reviewer-1",
      "approval-1",
      { decision: "approved", reviewComment: "ok" },
    );

    expect(reviewService.review).toHaveBeenCalledWith(
      "team-1",
      "reviewer-1",
      "approval-1",
      { decision: "approved", reviewComment: "ok" },
    );
    expect(result).toBe(reviewed);
    // facade 自身不触碰 CAS/audit（由 review service 在事务内处理）。
    expect(approvalRepository.reviewPending).not.toHaveBeenCalled();
    expect(approvalAuditService.writeApprovalAudit).not.toHaveBeenCalledWith(
      expect.anything(),
      "approval.approved",
      expect.anything(),
      expect.anything(),
    );
  });

  it("resolveApproved fails closed for rejected, consumed, expired and drifted approvals", async () => {
    const pending = { id: "approval-1", status: "pending" };
    const rejected = { id: "approval-1", status: "rejected" };
    const consumed = {
      id: "approval-1",
      status: "approved",
      consumedAt: new Date(),
    };
    const expired = {
      id: "approval-1",
      status: "approved",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    };
    const valid = {
      id: "approval-1",
      status: "approved",
      consumedAt: null,
      expiresAt: null,
      requesterId: "user-1",
      category: "release",
      action: "project.release_order.deploy_production",
      targetType: "release_run",
      targetId: "release-1",
      risk: "high",
    };

    for (const approval of [pending, rejected, consumed, expired]) {
      approvalRepository.findByIdForTeam.mockResolvedValue(approval);
      await expect(
        service.resolveApproved({
          teamId: "team-1",
          approvalId: "approval-1",
          category: "release",
          action: "project.release_order.deploy_production",
          targetType: "release_run",
          risk: "high",
        }),
      ).rejects.toThrow(BadRequestException);
    }

    approvalRepository.findByIdForTeam.mockResolvedValue(valid);
    approvalMatchService.assertMatches.mockImplementation(() => undefined);
    accessPolicyService.assertCanExecuteApproved.mockResolvedValue(undefined);
    await expect(
      service.resolveApproved({
        teamId: "team-1",
        requesterId: "user-1",
        approvalId: "approval-1",
        category: "release",
        action: "project.release_order.deploy_production",
        targetType: "release_run",
        risk: "high",
      }),
    ).resolves.toEqual(valid);
  });
});
