/**
 * 协调器审批链路单元测试（mock 依赖）：验证 advancePlan 调用 ensureStageApproval、
 * blocked 时跳过认领、approved 时把 approvalId 透传给 claimService；
 * finishAttempt 成功时消费审批。
 *
 * Slice 4 起，原子 claim 委托给 ReleaseStageClaimService（独立单测覆盖），
 * 完整 approve→ready→claim→succeed→consume 的真 MySQL 集成见
 * release-coordinator.integration.spec.ts。
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
    findById: jest.fn().mockResolvedValue(null),
    updateStatusIf: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockResolvedValue({}),
  };
  const attemptRepo = {
    findById: jest.fn().mockResolvedValue(null),
    findActiveByStage: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    claim: jest.fn(),
    finish: jest.fn().mockResolvedValue(1),
    linkRun: jest.fn(),
  };
  const leaseRepo = {
    acquireWithinTx: jest.fn(),
    releaseWithinTx: jest.fn(),
    renewWithinTx: jest.fn(),
  };
  const eventRepo = { append: jest.fn().mockResolvedValue({}) };
  const claimService = { claimAtomically: jest.fn().mockResolvedValue({ kind: "cas-lost" }) };
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
  const healthCheckAdapter = { execute: jest.fn() };
  const manualGateAdapter = { execute: jest.fn() };
  const prisma = { releaseConcurrencyLease: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } };
  const coordinator = new ReleaseCoordinatorService(
    prisma as any,
    stageRepo as any,
    attemptRepo as any,
    leaseRepo as any,
    planRepo as any,
    eventRepo as any,
    claimService as any,
    readiness as any,
    recovery as any,
    approvalLifecycle as any,
    serverCommandAdapter as any,
    deploymentRunAdapter as any,
    healthCheckAdapter as any,
    manualGateAdapter as any,
  );
  return {
    coordinator, planRepo, stageRepo, attemptRepo, leaseRepo, eventRepo,
    claimService, readiness, recovery, approvalLifecycle, serverCommandAdapter,
    healthCheckAdapter,
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
    expect(h.claimService.claimAtomically).not.toHaveBeenCalled();
  });

  it("advancePlan: low-risk stage skips approval binding (approvalId null to claim)", async () => {
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
    h.claimService.claimAtomically.mockResolvedValue({ kind: "cas-lost" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.approvalLifecycle.ensureStageApproval).toHaveBeenCalled();
    expect(h.readiness.assembleFacts).toHaveBeenCalled();
    // approved=null → claimAtomically 收到 approvalId=null
    expect(h.claimService.claimAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: null }),
    );
  });

  it("advancePlan: approved stage binds approvalId into claim request", async () => {
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
    h.claimService.claimAtomically.mockResolvedValue({ kind: "cas-lost" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.claimService.claimAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: "appr-9" }),
    );
  });

  it("advancePlan: concurrency-busy outcome marks stage blocked", async () => {
    const h = buildHarness();
    const stage = mkStage({ riskLevel: "low", status: "ready", concurrencyKey: "db:prod" });
    h.planRepo.findById.mockResolvedValue({
      id: "plan-1", teamId: "team-1", projectId: "proj-1", environmentId: "env-1",
      name: "P", createdById: "u-1", status: "running", stages: [stage],
    });
    h.approvalLifecycle.ensureStageApproval.mockResolvedValue({ approval: null, blocked: false });
    h.readiness.assembleFacts.mockResolvedValue({
      stageId: stage.id, status: "ready", required: true, currentAttempt: 0,
      hasActiveAttempt: false, dependencies: [], dependencyStates: [],
      approvalSatisfied: true, releaseExecutable: true, concurrencyAvailable: true,
    });
    h.readiness.compute.mockReturnValue({ ready: true, blocked: false, awaitingApproval: false });
    h.claimService.claimAtomically.mockResolvedValue({ kind: "concurrency-busy" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.stageRepo.updateStatusIf).toHaveBeenCalledWith(
      stage.id, ["ready"],
      expect.objectContaining({ status: "blocked", blockedReason: "等待并发键释放" }),
    );
  });

  it("finishAttempt: on succeeded with operationApprovalId → consumes approval", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    h.stageRepo.findById.mockResolvedValue({ status: "running" });
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
    h.stageRepo.findById.mockResolvedValue({ status: "running" });
    await h.coordinator.finishAttempt(
      stage,
      { id: "att-1", attemptNo: 1, status: "running", operationApprovalId: "appr-1" } as any,
      { status: "failed", error: "boom" } as any,
      "team-1",
      "u-1",
    );
    expect(h.approvalLifecycle.consume).not.toHaveBeenCalled();
  });

  // F383 D10（Slice 7）：logSummary 在 finishAttempt 单一 choke point 脱敏。
  // 与 Slice 1 的 Date guard 组合：password 命中敏感词 → [REDACTED]，
  // createdAt 的 Date 实例 → ISO 字符串（不被破坏成 {}）。
  it("finishAttempt: logSummary redacted via redactSecretsInObject (Date → ISO, secret → [REDACTED])", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    h.stageRepo.findById.mockResolvedValue({ status: "running" });
    const createdAt = new Date("2026-07-27T10:00:00.000Z");
    await h.coordinator.finishAttempt(
      stage,
      { id: "att-1", attemptNo: 1, status: "running", operationApprovalId: null } as any,
      {
        status: "succeeded",
        logSummary: { password: "supersecret", createdAt },
      } as any,
      "team-1",
      "u-1",
    );
    expect(h.attemptRepo.finish).toHaveBeenCalled();
    const finishCall = h.attemptRepo.finish.mock.calls[0];
    const persisted = finishCall[1].logSummary;
    expect(persisted).toEqual({
      password: "[REDACTED]",
      createdAt: "2026-07-27T10:00:00.000Z",
    });
    // 原始明文不得落库
    expect(JSON.stringify(persisted)).not.toContain("supersecret");
  });

  // F383 D7（Slice 7）：health_check 阶段按 type-first 路由到 HealthCheckStageAdapter，
  // 不再落到 ServerCommandStageAdapter 把 URL 当 shell 命令执行。
  it("advancePlan: health_check stage routes to HealthCheckStageAdapter (not ServerCommand)", async () => {
    const h = buildHarness();
    const stage = mkStage({
      type: "health_check",
      executorKind: "server_command",
      riskLevel: "low",
      status: "ready",
    });
    h.planRepo.findById.mockResolvedValue({
      id: "plan-1", teamId: "team-1", projectId: "proj-1", environmentId: "env-1",
      name: "P", createdById: "u-1", status: "running", stages: [stage],
    });
    h.approvalLifecycle.ensureStageApproval.mockResolvedValue({ approval: null, blocked: false });
    h.readiness.assembleFacts.mockResolvedValue({
      stageId: stage.id, status: "ready", required: true, currentAttempt: 0,
      hasActiveAttempt: false, dependencies: [], dependencyStates: [],
      approvalSatisfied: true, releaseExecutable: true, concurrencyAvailable: true,
    });
    h.readiness.compute.mockReturnValue({ ready: true, blocked: false, awaitingApproval: false });
    h.claimService.claimAtomically.mockResolvedValue({ kind: "won", attemptId: "att-new" });
    h.attemptRepo.findById.mockResolvedValue({
      id: "att-new", attemptNo: 1, status: "queued", operationApprovalId: null,
    });
    h.healthCheckAdapter.execute.mockResolvedValue({ status: "queued" });

    await h.coordinator.advancePlan("plan-1", "u-1");

    expect(h.healthCheckAdapter.execute).toHaveBeenCalled();
    expect(h.serverCommandAdapter.execute).not.toHaveBeenCalled();
  });
});

describe("ReleaseCoordinatorService.finalizeAndAdvance", () => {
  beforeEach(() => jest.clearAllMocks());

  function mkAttempt(over: Partial<{ id: string; status: string; releaseStageId: string }> = {}) {
    return {
      id: "att-1",
      status: "running",
      releaseStageId: "stage-1",
      attemptNo: 1,
      operationApprovalId: null,
      deploymentRunId: null,
      serverExecutionJobId: "sej-1",
      leaseExpiresAt: null,
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
      findById: jest.fn().mockResolvedValue(null),
      updateStatusIf: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({}),
    };
    const attemptRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findActiveByStage: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      claim: jest.fn(),
      finish: jest.fn().mockResolvedValue(1),
      linkRun: jest.fn(),
    };
    const leaseRepo = {
      acquireWithinTx: jest.fn(),
      releaseWithinTx: jest.fn(),
      renewWithinTx: jest.fn(),
    };
    const eventRepo = { append: jest.fn().mockResolvedValue({}) };
    const claimService = { claimAtomically: jest.fn().mockResolvedValue({ kind: "cas-lost" }) };
    const readiness = { assembleFacts: jest.fn(), compute: jest.fn() };
    const recovery = { scanAndRecover: jest.fn().mockResolvedValue(undefined) };
    const approvalLifecycle = {
      ensureStageApproval: jest.fn(),
      consume: jest.fn().mockResolvedValue(undefined),
    };
    const serverCommandAdapter = { execute: jest.fn() };
    const deploymentRunAdapter = { execute: jest.fn() };
    const healthCheckAdapter = { execute: jest.fn() };
    const manualGateAdapter = { execute: jest.fn() };
    const prisma = { releaseConcurrencyLease: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const coordinator = new ReleaseCoordinatorService(
      prisma as any,
      stageRepo as any,
      attemptRepo as any,
      leaseRepo as any,
      planRepo as any,
      eventRepo as any,
      claimService as any,
      readiness as any,
      recovery as any,
      approvalLifecycle as any,
      serverCommandAdapter as any,
      deploymentRunAdapter as any,
      healthCheckAdapter as any,
      manualGateAdapter as any,
    );
    return {
      coordinator, planRepo, stageRepo, attemptRepo, leaseRepo, eventRepo,
      claimService, readiness, recovery, approvalLifecycle,
    };
  }

  it("(a) attempt already terminal → finishAttempt not called (idempotent)", async () => {
    const h = buildHarness();
    h.attemptRepo.findById.mockResolvedValue(mkAttempt({ status: "succeeded" }));
    await h.coordinator.finalizeAndAdvance("plan-1", "att-1", {
      kind: "serverExecutionJob",
      id: "sej-1",
      result: { status: "completed" },
    });
    expect(h.attemptRepo.finish).not.toHaveBeenCalled();
  });

  it("(b) running attempt + serverExecutionJob completed → finishAttempt with succeeded", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    h.attemptRepo.findById.mockResolvedValue(mkAttempt({ status: "running" }));
    // finishAttempt 内会重读阶段当前状态
    h.stageRepo.findById.mockResolvedValue({ ...stage, status: "running" });
    // advancePlan 内 planRepo.findById 返回 null → 提前返回，不影响断言
    h.planRepo.findById.mockResolvedValue(null);

    await h.coordinator.finalizeAndAdvance("plan-1", "att-1", {
      kind: "serverExecutionJob",
      id: "sej-1",
      result: { status: "completed", result: { exitCode: 0 }, logs: ["ok"] },
    });

    expect(h.attemptRepo.finish).toHaveBeenCalled();
    const finishCall = h.attemptRepo.finish.mock.calls[0];
    expect(finishCall[1].status).toBe("succeeded");
  });

  it("(c) serverExecutionJob result.status failed → finishAttempt with failed + error", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    h.attemptRepo.findById.mockResolvedValue(mkAttempt({ status: "running" }));
    h.stageRepo.findById.mockResolvedValue({ ...stage, status: "running" });
    h.planRepo.findById.mockResolvedValue(null);

    await h.coordinator.finalizeAndAdvance("plan-1", "att-1", {
      kind: "serverExecutionJob",
      id: "sej-1",
      result: { status: "failed", error: "exit 1" },
    });

    expect(h.attemptRepo.finish).toHaveBeenCalled();
    const finishCall = h.attemptRepo.finish.mock.calls[0];
    expect(finishCall[1].status).toBe("failed");
    expect(finishCall[1].error).toContain("exit 1");
  });

  it("(d) interpreter throws → caught, logged, no rethrow", async () => {
    const h = buildHarness();
    // attemptRepo.findById 抛错模拟解释/读取链路异常
    h.attemptRepo.findById.mockRejectedValue(new Error("db down"));
    await expect(
      h.coordinator.finalizeAndAdvance("plan-1", "att-1", {
        kind: "serverExecutionJob",
        id: "sej-1",
        result: { status: "completed" },
      }),
    ).resolves.toBeUndefined();
    expect(h.attemptRepo.finish).not.toHaveBeenCalled();
  });

  it("deploymentRun terminal → interpreted via deploymentRun interpreter", async () => {
    const h = buildHarness();
    const stage = mkStage({ status: "running" });
    h.attemptRepo.findById.mockResolvedValue(mkAttempt({ status: "running" }));
    h.stageRepo.findById.mockResolvedValue({ ...stage, status: "running" });
    h.planRepo.findById.mockResolvedValue(null);

    await h.coordinator.finalizeAndAdvance("plan-1", "att-1", {
      kind: "deploymentRun",
      id: "dr-1",
      result: { status: "completed" },
    });

    expect(h.attemptRepo.finish).toHaveBeenCalled();
    const finishCall = h.attemptRepo.finish.mock.calls[0];
    expect(finishCall[1].status).toBe("succeeded");
  });
});
