/**
 * 协调器审批链路单元测试（mock 依赖）：验证 advancePlan 调用 ensureStageApproval、
 * blocked 时跳过认领、approved 时绑定审批；finishAttempt 成功时消费审批。
 * 完整 approve→ready→claim→succeed→consume 的真 MySQL 集成在 Slice 4/5 落地。
 */
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import type { ReadinessStageView } from "./release-readiness.service";

function mkStage(over: Partial<ReadinessStageView> = {}): ReadinessStageView {
  return {
    id: "stage-1",
    releasePlanId: "plan-1",
    teamId: "team-1",
    key: "schema_migration:svc",
    name: "迁移",
    type: "schema_migration",
    status: "pending",
    required: true,
    currentAttempt: 0,
    executorKind: "server_command",
    riskLevel: "medium",
    applicationId: null,
    applicationServiceId: null,
    environmentId: "env-1",
    serverId: null,
    configSnapshot: { command: "echo" },
    configHash: "hash-v1",
    concurrencyKey: null,
    stageApproval: null,
    releasePlan: { id: "plan-1", projectId: "proj-1", environmentId: "env-1", teamId: "team-1" },
    dependencies: [],
    attempts: [],
    ...over,
  };
}

function buildHarness() {
  const planRepo = {
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  };
  const stageRepo = {
    listByPlan: jest.fn().mockResolvedValue([]),
    updateStatusIf: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const attemptRepo = {
    findActiveByStage: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    claim: jest.fn(),
    finish: jest.fn().mockResolvedValue(1),
    linkRun: jest.fn(),
  };
  const eventRepo = { append: jest.fn().mockResolvedValue({}) };
  const readiness = {
    assembleFacts: jest.fn(),
    compute: jest.fn(),
  };
  const recovery = { scanAndRecover: jest.fn().mockResolvedValue(undefined) };
  const approvalLifecycle = {
    ensureStageApproval: jest.fn(),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const serverCommandAdapter = { execute: jest.fn() };
  const deploymentRunAdapter = { execute: jest.fn() };
  const manualGateAdapter = { execute: jest.fn() };
  const prisma = {};
  const coordinator = new ReleaseCoordinatorService(
    prisma as any,
    stageRepo as any,
    attemptRepo as any,
    planRepo as any,
    eventRepo as any,
    readiness as any,
    recovery as any,
    approvalLifecycle as any,
    serverCommandAdapter as any,
    deploymentRunAdapter as any,
    manualGateAdapter as any,
  );
  return {
    coordinator, planRepo, stageRepo, attemptRepo, eventRepo,
    readiness, recovery, approvalLifecycle, serverCommandAdapter,
  };
}

describe("ReleaseCoordinatorService approval chain", () => {
  beforeEach(() => jest.clearAllMocks());

  it("advancePlan: blocked (rejected) stage is skipped — no claim attempted", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "blocked" });
    h.planRepo.findById.mockResolvedValue({
      id: "plan-1",
      teamId: "team-1",
      projectId: "proj-1",
      environmentId: "env-1",
      name: "P",
      createdById: "u-1",
      status: "running",
      stages: [stage],
    });
    h.approvalLifecycle.ensureStageApproval.mockResolvedValue({
      approval: { id: "a-1", status: "rejected", inputHash: "h", expiresAt: null, consumedAt: null },
      blocked: true,
    });
    await h.coordinator.advancePlan("plan-1", "u-1");
    expect(h.approvalLifecycle.ensureStageApproval).toHaveBeenCalled();
    expect(h.attemptRepo.create).not.toHaveBeenCalled();
  });

  it("advancePlan: low-risk stage skips ensureStageApproval (approval null) but still evaluates readiness", async () => {
    const h = buildHarness();
    const stage = mkStage({ riskLevel: "low", status: "pending" });
    h.planRepo.findById.mockResolvedValue({
      id: "plan-1",
      teamId: "team-1",
      projectId: "proj-1",
      environmentId: "env-1",
      name: "P",
      createdById: "u-1",
      status: "running",
      stages: [stage],
    });
    h.approvalLifecycle.ensureStageApproval.mockResolvedValue({ approval: null, blocked: false });
    h.readiness.assembleFacts.mockResolvedValue({
      stageId: stage.id,
      status: "pending",
      required: true,
      currentAttempt: 0,
      hasActiveAttempt: false,
      dependencies: [],
      dependencyStates: [],
      approvalSatisfied: true,
      releaseExecutable: true,
      concurrencyAvailable: true,
    });
    h.readiness.compute.mockReturnValue({ ready: true, blocked: false, awaitingApproval: false });
    h.attemptRepo.create.mockResolvedValue({ id: "att-1", attemptNo: 1 });
    h.serverCommandAdapter.execute.mockResolvedValue({ status: "queued" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.approvalLifecycle.ensureStageApproval).toHaveBeenCalled();
    expect(h.readiness.assembleFacts).toHaveBeenCalled();
    // approved=null → no approval bound to attempt
    expect(h.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ operationApproval: undefined }),
    );
  });

  it("advancePlan: approved stage binds approvalId to created attempt", async () => {
    const h = buildHarness();
    const stage = mkStage({ riskLevel: "medium", status: "pending" });
    h.planRepo.findById.mockResolvedValue({
      id: "plan-1",
      teamId: "team-1",
      projectId: "proj-1",
      environmentId: "env-1",
      name: "P",
      createdById: "u-1",
      status: "running",
      stages: [stage],
    });
    h.approvalLifecycle.ensureStageApproval.mockResolvedValue({
      approval: {
        id: "appr-9",
        status: "approved",
        inputHash: "h",
        expiresAt: null,
        consumedAt: null,
      },
      blocked: false,
    });
    h.readiness.assembleFacts.mockResolvedValue({
      stageId: stage.id, status: "pending", required: true, currentAttempt: 0,
      hasActiveAttempt: false, dependencies: [], dependencyStates: [],
      approvalSatisfied: true, releaseExecutable: true, concurrencyAvailable: true,
    });
    h.readiness.compute.mockReturnValue({ ready: true, blocked: false, awaitingApproval: false });
    h.attemptRepo.create.mockResolvedValue({ id: "att-1", attemptNo: 1, status: "queued" });
    h.serverCommandAdapter.execute.mockResolvedValue({ status: "queued" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        operationApproval: { connect: { id: "appr-9" } },
      }),
    );
  });

  it("finishAttempt: on succeeded with operationApprovalId → consumes approval", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    await h.coordinator.finishAttempt(
      stage,
      { id: "att-1", attemptNo: 1, status: "running", operationApprovalId: "appr-1" } as any,
      { status: "succeeded" } as any,
      "team-1",
      "u-1",
    );
    expect(h.attemptRepo.finish).toHaveBeenCalled();
    expect(h.approvalLifecycle.consume).toHaveBeenCalledWith("team-1", "appr-1");
  });

  it("finishAttempt: on failed → does NOT consume approval", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    await h.coordinator.finishAttempt(
      stage,
      { id: "att-1", attemptNo: 1, status: "running", operationApprovalId: "appr-1" } as any,
      { status: "failed", error: "boom" } as any,
      "team-1",
      "u-1",
    );
    expect(h.approvalLifecycle.consume).not.toHaveBeenCalled();
  });
});
