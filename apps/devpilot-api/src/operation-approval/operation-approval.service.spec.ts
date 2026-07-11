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
});
