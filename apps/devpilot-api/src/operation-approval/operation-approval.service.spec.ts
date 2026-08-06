import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OperationApprovalService } from "./operation-approval.service";

describe("OperationApprovalService", () => {
  const approvalRepository = {
    list: jest.fn(),
    findReusablePending: jest.fn(),
    create: jest.fn(),
    findByIdForTeam: jest.fn(),
    review: jest.fn(),
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
  const service = new OperationApprovalService(
    approvalRepository as any,
    approvalMatchService as any,
    approvalAuditService as any,
    approvalRequirementService as any,
    accessPolicyService as any,
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

  it("reviews a pending approval as approved through the repository", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      status: "pending",
    });
    approvalRepository.review.mockImplementation(
      async (id, reviewerId, dto) => ({
        id,
        status: dto.decision,
        reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      }),
    );

    const reviewed = await service.review(
      "team-1",
      "reviewer-1",
      "approval-1",
      {
        decision: "approved",
      },
    );

    expect(approvalRepository.review).toHaveBeenCalledWith(
      "approval-1",
      "reviewer-1",
      { decision: "approved", reviewComment: undefined },
    );
    expect(approvalAuditService.writeApprovalAudit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "approval-1", status: "approved" }),
      "approval.approved",
      "approved",
    );
    expect(reviewed).toMatchObject({
      status: "approved",
      reviewerId: "reviewer-1",
    });
  });

  it("rejects a pending approval with the required review comment", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      status: "pending",
    });
    approvalRepository.review.mockImplementation(
      async (id, reviewerId, dto) => ({
        id,
        status: dto.decision,
        reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      }),
    );

    const reviewed = await service.review(
      "team-1",
      "reviewer-1",
      "approval-1",
      {
        decision: "rejected",
        reviewComment: "blocked by change window",
      },
    );

    expect(approvalRepository.review).toHaveBeenCalledWith(
      "approval-1",
      "reviewer-1",
      { decision: "rejected", reviewComment: "blocked by change window" },
    );
    expect(approvalAuditService.writeApprovalAudit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "approval-1", status: "rejected" }),
      "approval.rejected",
      "rejected",
    );
  });

  it("rejects review of a non-pending approval", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      status: "approved",
    });
    await expect(
      service.review("team-1", "reviewer-1", "approval-1", {
        decision: "approved",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(approvalRepository.review).not.toHaveBeenCalled();
  });

  it("throws when the approval does not belong to the team", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue(null);
    await expect(
      service.review("team-1", "reviewer-1", "approval-missing", {
        decision: "approved",
      }),
    ).rejects.toThrow(NotFoundException);
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
