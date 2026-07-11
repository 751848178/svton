import { OperationApprovalRequirementService } from "./operation-approval-requirement.service";

describe("OperationApprovalRequirementService", () => {
  const repository = {
    findRequesterRole: jest.fn(),
    listCandidatePolicies: jest.fn(),
  };
  const service = new OperationApprovalRequirementService(repository as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("describes matching approval requirements by resource, action, environment, and role", async () => {
    repository.findRequesterRole.mockResolvedValue("member");
    repository.listCandidatePolicies.mockResolvedValue([
      policy({
        id: "allow-ops",
        principalRole: "member",
        projectId: "project-1",
        environmentId: "env-prod",
        categories: ["resource_action"],
        actions: ["resource.action.*"],
        riskLevels: ["high"],
      }),
      policy({
        id: "unmatched-action",
        principalRole: "member",
        actions: ["deployment.rollback"],
      }),
    ]);

    await expect(
      service.evaluate({
        teamId: "team-1",
        requesterId: "user-1",
        projectId: "project-1",
        environmentId: "env-prod",
        category: "resource_action",
        action: "resource.action.restart",
        targetType: "managed_resource",
        risk: "high",
      }),
    ).resolves.toMatchObject({
      required: true,
      resourceType: "managed_resource",
      operationType: "resource.action.restart",
      environmentId: "env-prod",
      requesterRole: "member",
      defaultReviewerRole: "admin",
      additionalReviewerRoles: ["member"],
      matchedPolicies: [
        {
          id: "allow-ops",
          principalRole: "member",
          environmentId: "env-prod",
        },
      ],
    });
  });

  it("falls back to owner or admin when no allow policy matches", async () => {
    repository.findRequesterRole.mockResolvedValue("member");
    repository.listCandidatePolicies.mockResolvedValue([]);

    const requirement = await service.evaluate({
      teamId: "team-1",
      requesterId: "user-1",
      category: "deployment",
      action: "deployment.run",
      targetType: "deployment_run",
      risk: "high",
    });

    expect(requirement.reason).toContain("默认需 owner 或 admin 审批");
    expect(requirement.additionalReviewerRoles).toEqual([]);
  });
});

function policy(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-1",
    name: "Policy",
    effect: "allow",
    principalType: "team_role",
    principalRole: "admin",
    principalUserId: null,
    projectId: null,
    environmentId: null,
    categories: [],
    actions: [],
    riskLevels: [],
    priority: 0,
    ...overrides,
  };
}
