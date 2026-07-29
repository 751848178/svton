/**
 * 发布阶段→部署审批桥接单测（F383 P0-B）。
 * 用 mock PrismaService + OperationApprovalRepository 覆盖：
 *   - 父审批严格校验（未批准/已消费/过期/target 不匹配/inputHash 不匹配/scope 不一致 → fail-closed）
 *   - 派生审批创建（deployment 类别 + 父链路 metadata）
 *   - 幂等复用（同父审批已派生过 → 复用，不重复创建）
 */
import { ReleaseDeploymentApprovalBridgeService } from "./release-deployment-approval-bridge.service";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";

const STAGE = {
  id: "stage-1",
  releasePlanId: "plan-1",
  key: "application_deploy:svc-1",
  type: "application_deploy",
  applicationId: "app-1",
  applicationServiceId: "svc-1",
  environmentId: "env-1",
  serverId: "srv-1",
  configHash: "cfg-hash-v1",
};
const PLAN = { id: "plan-1", projectId: "proj-1", environmentId: "env-1", name: "发布 X" };
const DEPLOY_CTX = {
  projectId: "proj-1",
  environmentId: "env-1",
  applicationId: "app-1",
  applicationServiceId: "svc-1",
  serverId: "srv-1",
  targetType: "project",
  action: "deployment.run",
  risk: "medium",
};
const PARENT_INPUT_HASH = expectedStageInputHash({
  releasePlanId: PLAN.id,
  key: STAGE.key,
  environmentId: PLAN.environmentId,
  configHash: STAGE.configHash,
});

function buildService(overrides: {
  parent?: Record<string, unknown> | null;
  existingDerived?: Array<{ id: string; expiresAt: Date | null; metadata: unknown }>;
  createdId?: string;
}) {
  const parentRow = overrides.parent === undefined ? {
    id: "appr-release",
    category: "release_plan",
    status: "approved",
    consumedAt: null,
    expiresAt: null,
    targetType: "release_stage",
    targetId: STAGE.id,
    inputHash: PARENT_INPUT_HASH,
    projectId: PLAN.projectId,
    environmentId: PLAN.environmentId,
    requesterId: "user-1",
    risk: "medium",
  } : overrides.parent;

  const approvalRepo = {
    findByIdForTeam: jest.fn().mockResolvedValue(parentRow),
  };
  const existing = overrides.existingDerived ?? [];
  const createdId = overrides.createdId ?? "appr-derived";
  const createMock = jest.fn().mockResolvedValue({ id: createdId });
  const prisma = {
    operationApproval: {
      findMany: jest.fn().mockResolvedValue(existing),
      create: createMock,
    },
  };
  const svc = new ReleaseDeploymentApprovalBridgeService(
    prisma as never,
    approvalRepo as never,
  );
  return { svc, approvalRepo, prisma, createMock };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    teamId: "team-1",
    releaseApprovalId: "appr-release",
    stage: STAGE,
    plan: PLAN,
    deploymentContext: DEPLOY_CTX,
    ...overrides,
  };
}

describe("ReleaseDeploymentApprovalBridgeService", () => {
  it("derives a deployment approval from a valid approved release-stage parent", async () => {
    const { svc, createMock } = buildService({});
    const id = await svc.deriveDeploymentApproval(baseInput());
    expect(id).toBe("appr-derived");
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;
    expect(data.category).toBe("deployment");
    expect(data.action).toBe("deployment.run");
    expect(data.targetType).toBe("project");
    expect(data.targetId).toBe("proj-1");
    expect(data.status).toBe("approved");
    // 父审批链路写入 metadata
    expect(data.metadata.releaseApprovalId).toBe("appr-release");
    expect(data.metadata.releaseStageId).toBe(STAGE.id);
    expect(data.metadata.bridgedBy).toBe("release-deployment-approval-bridge");
  });

  it("reuses an existing derived approval (idempotent) instead of creating a new one", async () => {
    const { svc, createMock } = buildService({
      existingDerived: [
        { id: "appr-existing", expiresAt: null, metadata: { releaseApprovalId: "appr-release" } },
      ],
    });
    const id = await svc.deriveDeploymentApproval(baseInput());
    expect(id).toBe("appr-existing");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("ignores an expired derived approval and creates a fresh one", async () => {
    const past = new Date(Date.now() - 1000);
    const { svc, createMock } = buildService({
      existingDerived: [
        { id: "appr-expired", expiresAt: past, metadata: { releaseApprovalId: "appr-release" } },
      ],
      createdId: "appr-fresh",
    });
    const id = await svc.deriveDeploymentApproval(baseInput());
    expect(id).toBe("appr-fresh");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the parent approval is not approved", async () => {
    const { svc, createMock } = buildService({
      parent: { id: "appr-release", category: "release_plan", status: "pending", consumedAt: null, expiresAt: null, targetType: "release_stage", targetId: STAGE.id, inputHash: PARENT_INPUT_HASH, projectId: PLAN.projectId, environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/尚未批准/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when the parent approval is already consumed", async () => {
    const { svc } = buildService({
      parent: { id: "appr-release", category: "release_plan", status: "approved", consumedAt: new Date(), expiresAt: null, targetType: "release_stage", targetId: STAGE.id, inputHash: PARENT_INPUT_HASH, projectId: PLAN.projectId, environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/已被消费/);
  });

  it("fails closed when the parent approval inputHash does not match the current stage configHash", async () => {
    const { svc } = buildService({
      parent: { id: "appr-release", category: "release_plan", status: "approved", consumedAt: null, expiresAt: null, targetType: "release_stage", targetId: STAGE.id, inputHash: "stale-hash", projectId: PLAN.projectId, environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/输入哈希/);
  });

  it("fails closed when the parent approval scope (projectId) differs from the plan", async () => {
    const { svc } = buildService({
      parent: { id: "appr-release", category: "release_plan", status: "approved", consumedAt: null, expiresAt: null, targetType: "release_stage", targetId: STAGE.id, inputHash: PARENT_INPUT_HASH, projectId: "OTHER-PROJECT", environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/项目范围/);
  });

  it("fails closed when the parent approval targetType/targetId does not match the stage", async () => {
    const { svc } = buildService({
      parent: { id: "appr-release", category: "release_plan", status: "approved", consumedAt: null, expiresAt: null, targetType: "release_stage", targetId: "different-stage", inputHash: PARENT_INPUT_HASH, projectId: PLAN.projectId, environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/不匹配/);
  });

  it("fails closed when the parent approval is not a release_plan category (refuses non-release approvals)", async () => {
    const { svc } = buildService({
      parent: { id: "appr-release", category: "deployment", status: "approved", consumedAt: null, expiresAt: null, targetType: "project", targetId: "proj-1", inputHash: null, projectId: PLAN.projectId, environmentId: PLAN.environmentId },
    });
    await expect(svc.deriveDeploymentApproval(baseInput())).rejects.toThrow(/不是发布阶段审批/);
  });
});
