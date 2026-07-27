/**
 * F383 协调器集成测试（Slice 4）：在一次性 MySQL 8 上验证真实 ReleaseCoordinatorService
 * 的原子认领、并发租约、CAS-lost 无孤儿、pending-with-active 恢复、幂等、租约释放。
 *
 * 运行方式：
 *   docker run -d --rm --name svton-mysql-rel -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=rel -p 3399:3306 mysql:8
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" npx prisma migrate deploy
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" RUN_RELEASE_INTEGRATION=1 \
 *     npx jest src/release-orchestration/release-coordinator.integration.spec.ts
 *
 * 未设置 DATABASE_URL=...3399 或 RUN_RELEASE_INTEGRATION=1 时整体跳过（默认 CI 行为）。
 */
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseConcurrencyLeaseRepository } from "./repository/release-concurrency-lease.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseStageClaimService } from "./release-stage-claim.service";
import { ReleaseReadinessService } from "./release-readiness.service";
import { ReleaseRecoveryService } from "./release-recovery.service";
import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { ReleaseRecoverySchedulerService } from "./release-recovery-scheduler.service";
import { ReleasePlanService } from "./release-plan.service";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { ServerExecutorReleaseStageRunSyncService } from "../server-executor/server-executor-release-stage-run-sync.service";
import type { ServerExecutionResult } from "../server-executor/server-executor.types";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";
import { RELEASE_ORCHESTRATION_FLAG } from "./types/release-orchestration.types";

const DB_URL = process.env.DATABASE_URL ?? "";
const isIntegration = DB_URL.includes("3399") || process.env.RUN_RELEASE_INTEGRATION === "1";
const describeIntegration = isIntegration ? describe : (describe.skip as jest.Describe);

// 测试专用 ServerExecutorService 替身：queueExecution 写一行真实 ServerExecutionJob；
// cancelJob 把作业置 cancelled；completeJob 模拟回调完成。
// cancelJob 调用记录到 cancelledJobIds 数组，供取消场景断言。
class FakeServerExecutorService {
  readonly kind = "server_command";
  readonly cancelledJobIds: string[] = [];
  constructor(private readonly prisma: PrismaService) {}
  async queueExecution(
    input: {
      teamId: string;
      operationKey?: string;
      adapterKey?: string;
      metadata?: unknown;
      steps?: Array<{ command?: string }>;
    },
  ): Promise<{ serverExecutionJobId: string; queuedAt: Date }> {
    const job = await this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        operationKey: input.operationKey ?? "release_stage.test",
        adapterKey: input.adapterKey ?? "ssh-live",
        transport: "ssh",
        status: "queued",
        // 透传 steps（含 command）以便 health 路由测试断言 curl 命令被排队
        inputSnapshot: { steps: input.steps ?? [] },
        metadata: input.metadata as never,
      },
    });
    return { serverExecutionJobId: job.id, queuedAt: job.queuedAt };
  }
  async cancelJob(_teamId: string, _userId: string, id: string): Promise<void> {
    this.cancelledJobIds.push(id);
    await this.prisma.serverExecutionJob.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date(), finishedAt: new Date() },
    });
  }
  async completeJob(id: string, status: "completed" | "failed", result: Record<string, unknown> = {}): Promise<void> {
    await this.prisma.serverExecutionJob.update({
      where: { id },
      data: { status, finishedAt: new Date(), result: result as never },
    });
  }
}

// 真实 ServerCommandStageAdapter 的测试替身：直接复用其结构，但 executor 换成 fake
class FakeServerCommandStageAdapter implements ReleaseStageAdapter {
  readonly kind = "server_command";
  constructor(private readonly executor: FakeServerExecutorService) {}
  async execute(ctx: ReleaseStageExecutionContext): Promise<ReleaseStageExecutionResult> {
    const cfg = (ctx.configSnapshot ?? {}) as { __stageType?: string; command?: string };
    const r = await this.executor.queueExecution({
      teamId: ctx.teamId,
      operationKey: `release_stage.${cfg.__stageType ?? "test"}`,
      adapterKey: "ssh-live",
      steps: [{ command: cfg.command }],
      metadata: {
        businessRunSync: "release_stage",
        releasePlanId: ctx.releasePlanId,
        releaseStageId: ctx.releaseStageId,
        stageAttemptId: ctx.attemptId,
      },
    });
    return { status: "queued", serverExecutionJobId: r.serverExecutionJobId, logSummary: { queuedAt: r.queuedAt } };
  }
  async queue(ctx: ReleaseStageExecutionContext): Promise<ReleaseStageExecutionResult> {
    return this.execute(ctx);
  }
}

// DeploymentService 替身：不实际部署，只回填 queued 占位
class FakeDeploymentService {
  async createRun(teamId: string): Promise<{ id: string; status: string }> {
    return { id: `fake-dr-${Date.now()}`, status: "queued" };
  }
  async cancelRunIdempotent(): Promise<void> {}
}

// OperationApprovalService 替身：createPending 自动 approved，findLatestForTarget 返回 approved
class FakeOperationApprovalService {
  async createPending(input: { teamId: string; targetId?: string; inputHash?: string | null }) {
    return {
      id: `appr-${Math.random().toString(36).slice(2)}`,
      teamId: input.teamId,
      status: "approved",
      inputHash: input.inputHash ?? null,
      consumedAt: null,
      expiresAt: null,
      targetType: "release_stage",
      targetId: input.targetId ?? null,
    };
  }
  async consume(): Promise<void> {}
}
class FakeOperationApprovalRepository {
  async findLatestForTarget(): Promise<null> { return null; }
  async cancel(): Promise<number> { return 0; }
}

// 真实 DB 支持的 OperationApprovalService/Repository 替身（CR-2-1 真实审批流回归）：
// createPending 写一行 pending operationApproval；review 直接 updateMany 翻 approved；
// consume CAS 标记 consumedAt。findLatestForTarget 读真实最新行。这样 ensureStageApproval
// 的 approved-usable 分支、stage→awaiting_approval→ready/queued 转换都在真实 DB 上验证。
class RealDbOperationApprovalService {
  constructor(private readonly prisma: PrismaService) {}
  async createPending(input: {
    teamId: string;
    requesterId?: string | null;
    projectId?: string | null;
    environmentId?: string | null;
    applicationId?: string | null;
    applicationServiceId?: string | null;
    serverId?: string | null;
    category: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    risk: string;
    inputHash?: string | null;
    summary?: string | null;
    reason?: string | null;
  }) {
    return this.prisma.operationApproval.create({
      data: {
        teamId: input.teamId,
        requesterId: input.requesterId ?? null,
        projectId: input.projectId ?? null,
        environmentId: input.environmentId ?? null,
        applicationId: input.applicationId ?? null,
        applicationServiceId: input.applicationServiceId ?? null,
        serverId: input.serverId ?? null,
        category: input.category,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        risk: input.risk,
        inputHash: input.inputHash ?? null,
        summary: input.summary ?? null,
        reason: input.reason ?? null,
        status: "pending",
      },
    });
  }
  async consume(teamId: string, approvalId: string) {
    return this.prisma.operationApproval.updateMany({
      where: { id: approvalId, teamId, status: "approved", consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
  // 真实 review：仅当仍 pending 时翻为 approved
  async review(teamId: string, reviewerId: string, approvalId: string, decision: "approved" | "rejected") {
    await this.prisma.operationApproval.updateMany({
      where: { id: approvalId, teamId, status: "pending" },
      data: { status: decision, reviewerId, reviewedAt: new Date() },
    });
    return this.prisma.operationApproval.findFirstOrThrow({ where: { id: approvalId } });
  }
}
class RealDbOperationApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findLatestForTarget(teamId: string, targetType: string, targetId: string) {
    return this.prisma.operationApproval.findFirst({
      where: { teamId, targetType, targetId },
      orderBy: { createdAt: "desc" },
    });
  }
  async cancel(approvalId: string, currentStatus: string) {
    const r = await this.prisma.operationApproval.updateMany({
      where: { id: approvalId, status: currentStatus },
      data: { status: "cancelled" },
    });
    return r.count;
  }
}

interface Harness {
  prisma: PrismaService;
  coordinator: ReleaseCoordinatorService;
  executor: FakeServerExecutorService;
  releaseStageSync: ServerExecutorReleaseStageRunSyncService;
  releasePlanService: ReleasePlanService;
  leaseRepo: ReleaseConcurrencyLeaseRepository;
  schedulerFor: (enabled: boolean) => ReleaseRecoverySchedulerService;
  // 真实 DB 支持的审批服务/仓储（仅 CR-2-1 真实审批流场景使用；其余场景为 null）
  realApproval: RealDbOperationApprovalService | null;
}

async function buildHarness(): Promise<Harness> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const planRepo = new ReleasePlanRepository(prisma);
  const stageRepo = new ReleaseStageRepository(prisma);
  const attemptRepo = new ReleaseStageAttemptRepository(prisma);
  const leaseRepo = new ReleaseConcurrencyLeaseRepository(prisma);
  const eventRepo = new ReleaseEventRepository(prisma);
  const claimService = new ReleaseStageClaimService(prisma, leaseRepo);
  const readiness = new ReleaseReadinessService(stageRepo);
  const recovery = new ReleaseRecoveryService(prisma, planRepo);
  const approvalLifecycle = new ReleaseApprovalLifecycleService(
    new FakeOperationApprovalService() as never,
    new FakeOperationApprovalRepository() as never,
    stageRepo,
    eventRepo,
  );
  const executor = new FakeServerExecutorService(prisma);
  const serverCommandAdapter = new FakeServerCommandStageAdapter(executor);
  // 真实 HealthCheckStageAdapter 包裹 fake ServerCommandStageAdapter：
  // health_check 阶段会构造 sanitized curl 命令并委托给它排队（生产路径同构）。
  const healthCheckAdapter = new HealthCheckStageAdapter(
    serverCommandAdapter as unknown as ServerCommandStageAdapter,
  );
  const deploymentRunAdapter = {
    kind: "deployment_run",
    execute: async () => ({ status: "queued" as const }),
  } as never;
  const manualGateAdapter = { kind: "manual_gate", execute: async () => ({ status: "queued" as const }) } as never;
  const coordinator = new ReleaseCoordinatorService(
    prisma,
    stageRepo,
    attemptRepo,
    leaseRepo,
    planRepo,
    eventRepo,
    claimService,
    readiness,
    recovery,
    approvalLifecycle,
    serverCommandAdapter as never,
    deploymentRunAdapter,
    healthCheckAdapter,
    manualGateAdapter,
  );
  // 真实的 release-stage 完成同步服务：把 coordinator 作为 port 注入（生产路径同构）
  const releaseStageSync = new ServerExecutorReleaseStageRunSyncService(
    prisma,
    coordinator,
  );
  // 真实的 ReleasePlanService：feature flag 恒开，serverExecutor 用 fake
  const configOn = {
    get: (key: string, fallback?: string) =>
      key === RELEASE_ORCHESTRATION_FLAG ? "true" : (fallback ?? ""),
  } as never;
  const releasePlanService = new ReleasePlanService(
    configOn,
    prisma,
    planRepo,
    stageRepo,
    attemptRepo,
    eventRepo,
    coordinator,
    approvalLifecycle,
    executor as never,
  );
  // schedulerFor 注入 leaseRepo（CR-1-F1：runOnce 顶部 best-effort sweepExpired）
  const schedulerFor = (enabled: boolean) =>
    new ReleaseRecoverySchedulerService(
      coordinator,
      planRepo,
      leaseRepo,
      { get: (_k: string, fallback?: string) => (enabled ? "true" : (fallback ?? "false")) } as never,
    );
  return { prisma, coordinator, executor, releaseStageSync, releasePlanService, leaseRepo, schedulerFor, realApproval: null };
}

async function seedBaseline(prisma: PrismaService) {
  await prisma.releaseConcurrencyLease.deleteMany();
  await prisma.releaseEvent.deleteMany();
  await prisma.releaseStageAttempt.deleteMany();
  await prisma.releaseStageDependency.deleteMany();
  await prisma.releaseStage.deleteMany();
  await prisma.releasePlan.deleteMany();
  await prisma.serverExecutionJob.deleteMany();

  const team = await prisma.team.upsert({
    where: { id: "team-rel-int" },
    update: {},
    create: { id: "team-rel-int", name: "rel-integration" },
  });
  const user = await prisma.user.upsert({
    where: { email: "rel-int@test.local" },
    update: {},
    create: { id: "user-rel-int", email: "rel-int@test.local" },
  });
  const project = await prisma.project.upsert({
    where: { id: "proj-rel-int" },
    update: {},
    create: { id: "proj-rel-int", teamId: team.id, createdById: user.id, name: "rel-proj", config: {} },
  });
  const env = await prisma.projectEnvironment.upsert({
    where: { projectId_key: { projectId: project.id, key: "prod" } },
    update: {},
    create: { id: "env-rel-int", teamId: team.id, projectId: project.id, key: "prod", name: "prod" },
  });
  return { team, user, project, env };
}

async function seedReadyStage(
  prisma: PrismaService,
  over: {
    planName: string;
    stageKey: string;
    concurrencyKey?: string | null;
    riskLevel?: string;
    configHash?: string;
  },
) {
  const { team, env } = await seedBaseline(prisma);
  const plan = await prisma.releasePlan.create({
    data: {
      teamId: team.id,
      projectId: "proj-rel-int",
      environmentId: env.id,
      name: over.planName,
      status: "running",
      planHash: `h-${over.planName}`,
    },
  });
  const stage = await prisma.releaseStage.create({
    data: {
      releasePlanId: plan.id,
      teamId: team.id,
      key: over.stageKey,
      name: over.stageKey,
      type: "precheck",
      executorKind: "server_command",
      riskLevel: over.riskLevel ?? "low",
      required: true,
      status: "ready",
      currentAttempt: 0,
      concurrencyKey: over.concurrencyKey ?? null,
      configHash: over.configHash ?? "cfg-1",
      configSnapshot: { command: "echo hi" },
    },
  });
  return { team, env, plan, stage };
}

describeIntegration("release coordinator integration: atomic claim + lease + recovery", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await buildHarness();
  });
  afterAll(async () => {
    await h.prisma.$disconnect();
  });

  it("concurrent claim on same ready stage → exactly one attempt/SEJ/event", async () => {
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "claim-concurrent",
      stageKey: "precheck:s1",
    });
    await Promise.all([
      h.coordinator.advancePlan(plan.id),
      h.coordinator.advancePlan(plan.id),
    ]);

    const attempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(attempts.length).toBe(1);
    const events = await h.prisma.releaseEvent.findMany({
      where: { releaseStageId: stage.id, eventType: "release_stage.claimed" },
    });
    expect(events.length).toBe(1);
    const jobs = await h.prisma.serverExecutionJob.findMany();
    expect(jobs.length).toBe(1);
  });

  it("concurrent same concurrencyKey → exactly one stage queued; lease table one row", async () => {
    const ck = "db:prod";
    const { plan } = await seedReadyStage(h.prisma, {
      planName: "conc-key",
      stageKey: "migration:s1",
      concurrencyKey: ck,
      riskLevel: "low",
    });
    // 同 plan 内第二个阶段共享 ck
    await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: "team-rel-int",
        key: "migration:s2",
        name: "m2",
        type: "schema_migration",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        concurrencyKey: ck,
        configHash: "cfg-2",
        configSnapshot: { command: "echo m2" },
      },
    });

    await Promise.all([h.coordinator.advancePlan(plan.id), h.coordinator.advancePlan(plan.id)]);

    const queued = await h.prisma.releaseStage.findMany({
      where: { releasePlanId: plan.id, status: { in: ["queued", "running"] } },
    });
    expect(queued.length).toBe(1);
    const leases = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leases.length).toBe(1);
  });

  it("CAS-lost / already-active → no orphan attempt or SEJ", async () => {
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "cas-lost",
      stageKey: "precheck:cas",
    });
    // 第一次认领成功
    await h.coordinator.advancePlan(plan.id);
    const firstAttempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(firstAttempts.length).toBe(1);
    const firstJobs = await h.prisma.serverExecutionJob.findMany();
    const jobsBefore = firstJobs.length;

    // 第二次 advancePlan：阶段已 queued/running，应 already-active 短路，无新 attempt/SEJ
    await h.coordinator.advancePlan(plan.id);
    const afterAttempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(afterAttempts.length).toBe(1);
    const afterJobs = await h.prisma.serverExecutionJob.findMany();
    expect(afterJobs.length).toBe(jobsBefore);
  });

  it("pending-with-active-attempt recovered → finishes succeeded", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "pending-recover",
        status: "running",
        planHash: "h-pending",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:pending",
        name: "pending",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "pending", // P0-1 leftover
        currentAttempt: 1,
        configSnapshot: { command: "echo p" },
      },
    });
    const job = await h.prisma.serverExecutionJob.create({
      data: {
        teamId: team.id,
        operationKey: "release_stage.precheck",
        adapterKey: "ssh-live",
        transport: "ssh",
        status: "completed",
        inputSnapshot: { steps: [] },
        result: { exitCode: 0 },
        logs: [{ level: "info", message: "ok" }],
      },
    });
    await h.prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "queued",
        serverExecutionJobId: job.id,
      },
    });

    await h.coordinator.advancePlan(plan.id);

    const finalStage = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(finalStage?.status).toBe("succeeded");
    const attempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(attempts[0]?.status).toBe("succeeded");
  });

  it("idempotency: stage with succeeded attempt → no re-claim", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "idem",
        status: "running",
        planHash: "h-idem",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "bootstrap:idem",
        name: "bootstrap",
        type: "bootstrap",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "succeeded",
        currentAttempt: 1,
        configSnapshot: { command: "echo b" },
      },
    });
    await h.prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "succeeded",
        finishedAt: new Date(),
      },
    });
    const beforeCount = await h.prisma.releaseStageAttempt.count({ where: { releaseStageId: stage.id } });

    await h.coordinator.advancePlan(plan.id);

    const afterCount = await h.prisma.releaseStageAttempt.count({ where: { releaseStageId: stage.id } });
    expect(afterCount).toBe(beforeCount); // 不新增 attempt（D8 已 succeeded 短路）
  });

  it("lease released on finish", async () => {
    const ck = "lease-finish-test";
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "lease-release",
      stageKey: "precheck:lease",
      concurrencyKey: ck,
    });
    await h.coordinator.advancePlan(plan.id);
    // 认领后应有租约
    const leaseAfterClaim = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leaseAfterClaim.length).toBe(1);

    // 拿到关联作业，标记 completed，触发 finishAttempt
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { releaseStageId: stage.id } });
    const job = await h.prisma.serverExecutionJob.findFirstOrThrow({ where: { id: attempt.serverExecutionJobId ?? undefined } });
    await h.executor.completeJob(job.id, "completed", { exitCode: 0 });
    // 再次 advancePlan 触发恢复链路收尾
    await h.coordinator.advancePlan(plan.id);

    const finalStage = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(finalStage?.status).toBe("succeeded");
    const leaseAfterFinish = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leaseAfterFinish.length).toBe(0);
  });

  it("SEJ completion → attempt succeeded → successor stage becomes claimable (full chain)", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "completion-chain",
        status: "running",
        planHash: "h-chain",
      },
    });
    // 前置阶段（server_command，低风险，ready）
    const predStage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:pred",
        name: "pred",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        configSnapshot: { command: "echo pred" },
      },
    });
    // 后继阶段（依赖前置成功）
    const succStage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "bootstrap:succ",
        name: "succ",
        type: "bootstrap",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "pending",
        currentAttempt: 0,
        configSnapshot: { command: "echo succ" },
      },
    });
    await h.prisma.releaseStageDependency.create({
      data: {
        stageId: succStage.id,
        dependsOnStageId: predStage.id,
        conditionType: "succeeded",
        conditionSnapshot: { required: true },
      },
    });

    // 1. advancePlan 认领前置阶段 → 创建 attempt + 真实 SEJ
    await h.coordinator.advancePlan(plan.id);
    const predAttempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { releaseStageId: predStage.id },
    });
    expect(predAttempt.serverExecutionJobId).toBeTruthy();
    const jobId = predAttempt.serverExecutionJobId as string;

    // 后继阶段此时还不可认领（依赖未满足）
    const succBefore = await h.prisma.releaseStage.findUnique({ where: { id: succStage.id } });
    expect(succBefore?.status).toBe("pending");
    const succAttemptBefore = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: succStage.id } });
    expect(succAttemptBefore.length).toBe(0);

    // 2. 模拟 SEJ 完成回调：调用 releaseStageSync.syncAfterExecution（生产路径同构）
    const result: ServerExecutionResult = {
      status: "completed",
      mode: "executed",
      executorKey: "server-executor",
      adapterKey: "ssh-live",
      executable: true,
      warnings: [],
      commandSteps: [],
      commandPlan: { steps: [] },
      logs: [{ stream: "stdout", message: "ok" }],
      result: { exitCode: 0 },
    };
    await h.releaseStageSync.syncAfterExecution(
      {
        teamId: team.id,
        operationKey: "release_stage.precheck",
        adapterKey: "ssh-live",
        dryRun: false,
        target: { transport: "ssh", serverId: null },
        steps: [],
      } as never,
      jobId,
      result,
      {
        businessRunSync: "release_stage",
        releasePlanId: plan.id,
        releaseStageId: predStage.id,
        stageAttemptId: predAttempt.id,
      },
    );

    // 3. 断言：前置 attempt succeeded、前置阶段 succeeded
    const predFinal = await h.prisma.releaseStage.findUnique({ where: { id: predStage.id } });
    expect(predFinal?.status).toBe("succeeded");
    const predAttemptFinal = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { id: predAttempt.id },
    });
    expect(predAttemptFinal.status).toBe("succeeded");

    // 4. 断言：后继阶段已被解锁并认领（completion→advance 全链路验证）
    const succAfter = await h.prisma.releaseStage.findUnique({ where: { id: succStage.id } });
    expect(["queued", "running", "succeeded"]).toContain(succAfter?.status);
    const succAttemptAfter = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: succStage.id } });
    expect(succAttemptAfter.length).toBe(1);
  });
  it("finalizeAndAdvance is idempotent: repeated completion callbacks do not double-finish", async () => {
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "finalize-idem",
      stageKey: "precheck:fidem",
    });
    await h.coordinator.advancePlan(plan.id);
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { releaseStageId: stage.id } });
    const jobId = attempt.serverExecutionJobId as string;

    // 第一次完成回调
    await h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
      kind: "serverExecutionJob", id: jobId, result: { status: "completed", result: { exitCode: 0 }, logs: [] },
    });
    const attemptAfter1 = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { id: attempt.id } });
    expect(attemptAfter1.status).toBe("succeeded");

    // 第二次重复回调：幂等，不应抛错、不应改动
    await expect(
      h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
        kind: "serverExecutionJob", id: jobId, result: { status: "completed" },
      }),
    ).resolves.toBeUndefined();
    const attemptAfter2 = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { id: attempt.id } });
    expect(attemptAfter2.status).toBe("succeeded");
    // 仍只有一个 attempt（没有重复创建）
    const allAttempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(allAttempts.length).toBe(1);
  });

  it("scheduler runOnce advances a non-terminal plan with a ready stage", async () => {
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "sched-advance",
      stageKey: "precheck:sched",
    });
    const scheduler = h.schedulerFor(true);

    const summary = await scheduler.runOnce();

    expect(summary.skipped).toBe(false);
    expect(summary.scanned).toBeGreaterThanOrEqual(1);
    // 计划内 ready 阶段应被认领（attempt + SEJ）
    const attempt = await h.prisma.releaseStageAttempt.findFirst({ where: { releaseStageId: stage.id } });
    expect(attempt).toBeTruthy();
    const finalStage = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(["queued", "running", "succeeded"]).toContain(finalStage?.status);
  });

  it("scheduler runOnce skipped when disabled — touches nothing", async () => {
    const beforePlans = await h.prisma.releasePlan.count();
    const scheduler = h.schedulerFor(false);

    const summary = await scheduler.runOnce();

    expect(summary.skipped).toBe(true);
    // 没有任何计划被改动
    const afterPlans = await h.prisma.releasePlan.count();
    expect(afterPlans).toBe(beforePlans);
  });

  // === Slice 7: health_check routing + sanitized curl (P0-6, P1-5) ===

  it("health_check stage routes to HealthCheckStageAdapter (SEJ command is curl loop, not raw URL)", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "health-route",
        status: "running",
        planHash: "h-health-route",
      },
    });
    await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "health_check:svc",
        name: "health",
        type: "health_check",
        executorKind: "server_command", // 注意：executorKind 仍为 server_command，路由靠 type
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        configSnapshot: {
          healthCheckUrl: "http://127.0.0.1:4100/api/health/readiness",
          timeoutMs: 10_000,
          intervalMs: 5_000,
          maxAttempts: 6,
        },
      },
    });

    await h.coordinator.advancePlan(plan.id);

    const stage = await h.prisma.releaseStage.findFirstOrThrow({
      where: { releasePlanId: plan.id },
    });
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { releaseStageId: stage.id },
    });
    expect(attempt.serverExecutionJobId).toBeTruthy();
    const job = await h.prisma.serverExecutionJob.findFirstOrThrow({
      where: { id: attempt.serverExecutionJobId ?? undefined },
    });
    // SEJ 的 inputSnapshot.steps[0].command 必须是 curl 循环（而不是裸 URL）。
    const steps = (job.inputSnapshot as { steps?: Array<{ command?: string }> }).steps ?? [];
    const cmd = steps[0]?.command ?? "";
    expect(cmd).toContain("for i in $(seq 1 6)");
    expect(cmd).toContain("curl ");
    expect(cmd).toContain("'http://127.0.0.1:4100/api/health/readiness'");
    // 关键反断言：URL 没有被当成裸 shell 命令（旧 bug 会直接把 http://... 排队执行）
    expect(cmd.trim()).not.toMatch(/^https?:\/\//);
  });

  it("health_check stage completes succeeded on 2xx + @@DEVPILOT_OUTPUT@@ ready:true sentinel", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "health-complete",
        status: "running",
        planHash: "h-health-complete",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "health_check:complete",
        name: "health-c",
        type: "health_check",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        configSnapshot: {
          healthCheckUrl: "http://127.0.0.1:4100/api/health/readiness",
        },
      },
    });

    await h.coordinator.advancePlan(plan.id);
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { releaseStageId: stage.id },
    });
    const jobId = attempt.serverExecutionJobId as string;

    // 构造 ready:true + httpStatus:200 哨兵载荷，模拟 curl 在目标主机成功探针
    const payloadObj = {
      schemaVersion: 1,
      summary: "ready",
      values: { ready: true, httpStatus: 200 },
      metrics: { attempts: 1 },
    };
    const b64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64");
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result: ServerExecutionResult = {
      status: "completed",
      mode: "executed",
      executorKey: "server-executor",
      adapterKey: "ssh-live",
      executable: true,
      warnings: [],
      commandSteps: [],
      commandPlan: { steps: [] },
      logs: [
        { stream: "stdout", message: "probe start" },
        { stream: "stdout", message: `@@DEVPILOT_OUTPUT@@ ${b64url}` },
      ],
      result: { exitCode: 0 },
    };
    await h.releaseStageSync.syncAfterExecution(
      {
        teamId: team.id,
        operationKey: "release_stage.health_check",
        adapterKey: "ssh-live",
        dryRun: false,
        target: { transport: "ssh", serverId: null },
        steps: [],
      } as never,
      jobId,
      result,
      {
        businessRunSync: "release_stage",
        releasePlanId: plan.id,
        releaseStageId: stage.id,
        stageAttemptId: attempt.id,
      },
    );

    const stageAfter = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(stageAfter?.status).toBe("succeeded");
    const attemptAfter = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { id: attempt.id },
    });
    expect(attemptAfter.status).toBe("succeeded");
    // 哨兵解析出的结构化输出落到 attempt.output（ready:true, httpStatus:200）
    const out = attemptAfter.output as { values?: { ready?: boolean; httpStatus?: number } } | null;
    expect(out?.values?.ready).toBe(true);
    expect(out?.values?.httpStatus).toBe(200);
    // 终态 logSummary（interpret 层 cleanedLogsPreview）经 D10 脱敏后不含完整 URL/path
    expect(JSON.stringify(attemptAfter.logSummary)).not.toContain("/api/health");
  });

  // === Slice 6: transactional retry + cancel (P0-7, P0-8) ===

  it("retry reopens failed plan + stage, creates attempt 2, appends stage_retried event", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "retry-reopen",
        status: "failed",
        planHash: "h-retry",
        finishedAt: new Date(),
        blockedReason: "存在失败阶段",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:retry",
        name: "retry",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "failed",
        currentAttempt: 1,
        configSnapshot: { command: "echo retry" },
      },
    });
    // 已存在的失败 attempt（attemptNo=1）
    await h.prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "failed",
        finishedAt: new Date(),
        error: "boom",
      },
    });

    await h.releasePlanService.retryStage(team.id, plan.id, stage.id, "user-rel-int");

    // 计划重开：failed→running，finishedAt 清空
    const planAfter = await h.prisma.releasePlan.findUnique({ where: { id: plan.id } });
    expect(planAfter?.status).toBe("running");
    expect(planAfter?.finishedAt).toBeNull();

    // 阶段从 failed 转入 ready/queued/running；并创建新 attempt（attemptNo=2）
    const stageAfter = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(["ready", "queued", "running"]).toContain(stageAfter?.status);
    const attempts = await h.prisma.releaseStageAttempt.findMany({
      where: { releaseStageId: stage.id },
      orderBy: { attemptNo: "asc" },
    });
    expect(attempts.length).toBe(2);
    expect(attempts[1]?.attemptNo).toBe(2);

    // stage_retried 事件已追加
    const retriedEvents = await h.prisma.releaseEvent.findMany({
      where: { releaseStageId: stage.id, eventType: "release_stage.retried" },
    });
    expect(retriedEvents.length).toBe(1);
  });

  it("concurrent retryStage on same failed stage → second loses cleanly (ConflictException)", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "retry-concurrent",
        status: "failed",
        planHash: "h-retry-c",
        finishedAt: new Date(),
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:retry-c",
        name: "retry-c",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "failed",
        currentAttempt: 1,
        configSnapshot: { command: "echo rc" },
      },
    });

    // 串行调用第二次：第一次已把 stage 翻转为 ready，第二次 CAS count===0 → ConflictException
    await h.releasePlanService.retryStage(team.id, plan.id, stage.id, "user-rel-int");
    await expect(
      h.releasePlanService.retryStage(team.id, plan.id, stage.id, "user-rel-int"),
    ).rejects.toThrow(ConflictException);

    // 仍只有一个新 attempt（attemptNo=2），没有第三次
    const attempts = await h.prisma.releaseStageAttempt.findMany({
      where: { releaseStageId: stage.id },
    });
    expect(attempts.filter((a) => a.attemptNo >= 2).length).toBe(1);
  });

  it("cancel mid-run invokes cancelJob, flips all rows, releases leases, appends plan_canceled event", async () => {
    const ck = "cancel-lease-test";
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "cancel-mid-run",
        status: "running",
        planHash: "h-cancel",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:cancel",
        name: "cancel",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        concurrencyKey: ck,
        configSnapshot: { command: "echo cancel" },
      },
    });

    // 1. advancePlan 认领阶段 → 创建 attempt + 真实 SEJ + 租约
    await h.coordinator.advancePlan(plan.id);
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({
      where: { releaseStageId: stage.id },
    });
    const jobId = attempt.serverExecutionJobId as string;
    expect(jobId).toBeTruthy();
    const leasesBefore = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leasesBefore.length).toBe(1);
    h.executor.cancelledJobIds.length = 0;

    // 2. cancel
    await h.releasePlanService.cancel(team.id, plan.id, "user-rel-int");

    // 真实 SEJ 被 cancelJob 调用
    expect(h.executor.cancelledJobIds).toContain(jobId);
    // 计划终态
    const planAfter = await h.prisma.releasePlan.findUnique({ where: { id: plan.id } });
    expect(planAfter?.status).toBe("canceled");
    expect(planAfter?.canceledAt).toBeTruthy();
    // 阶段全部 canceled
    const stages = await h.prisma.releaseStage.findMany({ where: { releasePlanId: plan.id } });
    expect(stages.every((s) => s.status === "canceled")).toBe(true);
    // attempt 全部 canceled，租约清空
    const attempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(attempts.every((a) => a.status === "canceled" && a.leaseOwner === null)).toBe(true);
    const leasesAfter = await h.prisma.releaseConcurrencyLease.findMany({ where: { releaseStage: { releasePlanId: plan.id } } });
    expect(leasesAfter.length).toBe(0);
    // plan_canceled 事件已追加
    const cancelEvents = await h.prisma.releaseEvent.findMany({
      where: { releasePlanId: plan.id, eventType: "release_plan.canceled" },
    });
    expect(cancelEvents.length).toBe(1);
  });

  it("cancel is atomic: second cancel after terminal → ConflictException, no partial state", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "cancel-atomic",
        status: "running",
        planHash: "h-cancel-a",
      },
    });
    await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:cancel-a",
        name: "cancel-a",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        currentAttempt: 0,
        configSnapshot: { command: "echo ca" },
      },
    });
    await h.coordinator.advancePlan(plan.id);

    // 第一次取消成功
    await h.releasePlanService.cancel(team.id, plan.id, "user-rel-int");
    const planAfter1 = await h.prisma.releasePlan.findUnique({ where: { id: plan.id } });
    expect(planAfter1?.status).toBe("canceled");

    // 第二次取消：计划已终态 → ConflictException（原子性后验：无中间态可被二次取消消费）
    await expect(
      h.releasePlanService.cancel(team.id, plan.id, "user-rel-int"),
    ).rejects.toThrow(ConflictException);

    // 后验原子不变式：成功取消后非终态阶段/attempt/租约为零
    const nonTerminalStages = await h.prisma.releaseStage.findMany({
      where: { releasePlanId: plan.id, status: { in: ["pending", "blocked", "awaiting_approval", "ready", "queued", "running"] } },
    });
    expect(nonTerminalStages.length).toBe(0);
    const nonTerminalAttempts = await h.prisma.releaseStageAttempt.findMany({
      where: { releaseStage: { releasePlanId: plan.id }, status: { in: ["queued", "running"] } },
    });
    expect(nonTerminalAttempts.length).toBe(0);
    const leases = await h.prisma.releaseConcurrencyLease.findMany({
      where: { releaseStage: { releasePlanId: plan.id } },
    });
    expect(leases.length).toBe(0);
  });

  // === CR fixes ===

  // CR-2-1: 真实 DB 审批流——pending→approved→claimed→succeeded+consumed，无第二个 pending。
  // 用真实 DB 支持的 OperationApprovalService/Repository（写真实 operationApproval 行），
  // 验证 ensureStageApproval 的 approved-usable 分支不再 mint 第二个 pending。
  it("CR-2-1: real-DB approve flow — pending→approved→claimed→succeeded+consumed, no second pending", async () => {
    // 独立 harness：approvalLifecycle 注入真实 DB 支持的 approval service/repository
    const prisma = h.prisma;
    const planRepo = new ReleasePlanRepository(prisma);
    const stageRepo = new ReleaseStageRepository(prisma);
    const attemptRepo = new ReleaseStageAttemptRepository(prisma);
    const leaseRepo = new ReleaseConcurrencyLeaseRepository(prisma);
    const eventRepo = new ReleaseEventRepository(prisma);
    const realApproval = new RealDbOperationApprovalService(prisma);
    const realApprovalRepo = new RealDbOperationApprovalRepository(prisma);
    const claimService = new ReleaseStageClaimService(prisma, leaseRepo);
    const readiness = new ReleaseReadinessService(stageRepo);
    const recovery = new ReleaseRecoveryService(prisma, planRepo);
    const approvalLifecycle = new ReleaseApprovalLifecycleService(
      realApproval as never,
      realApprovalRepo as never,
      stageRepo,
      eventRepo,
    );
    const executor = new FakeServerExecutorService(prisma);
    const serverCommandAdapter = new FakeServerCommandStageAdapter(executor);
    const coordinator = new ReleaseCoordinatorService(
      prisma, stageRepo, attemptRepo, leaseRepo, planRepo, eventRepo,
      claimService, readiness, recovery, approvalLifecycle,
      serverCommandAdapter as never,
      { kind: "deployment_run", execute: async () => ({ status: "queued" as const }) } as never,
      { kind: "health_check", execute: async () => ({ status: "queued" as const }) } as never,
      { kind: "manual_gate", execute: async () => ({ status: "queued" as const }) } as never,
    );

    const { team, env } = await seedBaseline(prisma);
    await prisma.operationApproval.deleteMany();
    const plan = await prisma.releasePlan.create({
      data: {
        teamId: team.id, projectId: "proj-rel-int", environmentId: env.id,
        name: "cr-approval-flow", status: "running", planHash: "h-cr-approval",
      },
    });
    // 中风险 server_command 阶段：触发审批绑定。
    // environmentId 必须设置——readiness.isStageApprovalUsable 用 stage.environmentId
    // 派生期望 inputHash（与 lifecycle 用 plan.environmentId 派生一致需同源）。
    const stage = await prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id, teamId: team.id,
        key: "precheck:approval", name: "approval", type: "precheck",
        executorKind: "server_command", riskLevel: "medium", required: true,
        status: "ready", currentAttempt: 0, configHash: "cfg-approval",
        environmentId: env.id,
        configSnapshot: { command: "echo ok" },
      },
    });

    // 1. advancePlan：阶段 readiness 因审批未满足 → ensureStageApproval 建 pending 行
    //    （stage 不会 queued；stageApproval.status==='pending' → isApprovalUsable=false → 不 ready）
    await coordinator.advancePlan(plan.id);
    const pendingAfterInit = await prisma.operationApproval.findMany({
      where: { targetType: "release_stage", targetId: stage.id },
    });
    expect(pendingAfterInit.length).toBe(1);
    expect(pendingAfterInit[0].status).toBe("pending");
    const stageAfterInit = await prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(["ready", "pending", "awaiting_approval"]).toContain(stageAfterInit?.status);
    const attemptsBefore = await prisma.releaseStageAttempt.count({ where: { releaseStageId: stage.id } });
    expect(attemptsBefore).toBe(0);

    // 2. 人工审批通过：直接翻 pending→approved（真实 DB updateMany）
    await realApproval.review(team.id, "user-rel-int", pendingAfterInit[0].id, "approved");

    // 3. 再次 advancePlan：approved-usable 分支复用审批，不再 mint 第二个 pending；
    //    readiness satisfied → claim → attempt created + stage queued/running
    await coordinator.advancePlan(plan.id);
    const approvalsAfterClaim = await prisma.operationApproval.findMany({
      where: { targetType: "release_stage", targetId: stage.id },
      orderBy: { createdAt: "asc" },
    });
    expect(approvalsAfterClaim.length).toBe(1); // 关键：仍只有 1 行，无第二个 pending
    expect(approvalsAfterClaim[0].status).toBe("approved");
    const stageAfterClaim = await prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(["queued", "running"]).toContain(stageAfterClaim?.status);
    const attempts = await prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(attempts.length).toBe(1);
    expect(attempts[0].operationApprovalId).toBe(approvalsAfterClaim[0].id);

    // 4. SEJ 完成 → 收尾：attempt succeeded + 审批 consumed + 阶段 succeeded + 计划 succeeded
    const jobId = attempts[0].serverExecutionJobId as string;
    await executor.completeJob(jobId, "completed", { exitCode: 0 });
    await coordinator.advancePlan(plan.id);

    const attemptFinal = await prisma.releaseStageAttempt.findFirstOrThrow({ where: { id: attempts[0].id } });
    expect(attemptFinal.status).toBe("succeeded");
    const approvalFinal = await prisma.operationApproval.findFirstOrThrow({ where: { id: approvalsAfterClaim[0].id } });
    expect(approvalFinal.consumedAt).toBeTruthy(); // 已消费
    const stageFinal = await prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(stageFinal?.status).toBe("succeeded");
    // 全程仅 1 个审批行（无第二个 pending）
    const allApprovals = await prisma.operationApproval.findMany({
      where: { targetType: "release_stage", targetId: stage.id },
    });
    expect(allApprovals.length).toBe(1);
  });

  // CR-1-F1: 过期租约 CAS 抢占——同一 concurrencyKey 上一个 owner 的租约已过期，
  // 新 owner 通过 updateMany CAS-steal 成功。
  it("CR-1-F1: stale lease → CAS steal succeeds (new owner wins, single row)", async () => {
    const ck = "cr-lease-steal";
    const { team } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id, projectId: "proj-rel-int", environmentId: "env-rel-int",
        name: "lease-steal", status: "running", planHash: "h-steal",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id, teamId: team.id,
        key: "precheck:steal", name: "steal", type: "precheck",
        executorKind: "server_command", riskLevel: "low", required: true,
        status: "pending", currentAttempt: 0, concurrencyKey: ck,
        configSnapshot: { command: "echo s" },
      },
    });
    // 预置一个已过期的租约行（旧 owner）
    await h.prisma.releaseConcurrencyLease.create({
      data: {
        concurrencyKey: ck, releaseStageId: stage.id, attemptId: "old-att",
        owner: "old-owner", acquiredAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() - 30_000), // 已过期
      },
    });

    // 通过 acquireWithinTx 直接验证：新 owner 应能 CAS-steal
    const won = await h.prisma.$transaction(async (tx) =>
      h.leaseRepo.acquireWithinTx(tx, {
        concurrencyKey: ck, releaseStageId: stage.id, attemptId: "new-att",
        owner: "new-owner", expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    expect(won).toBe(true);
    const leases = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leases.length).toBe(1); // 仍只一行，owner 已被抢占
    expect(leases[0].owner).toBe("new-owner");
    expect(leases[0].attemptId).toBe("new-att");
  });

  // CR-1-F1: 活跃租约——同一 concurrencyKey 上现租约未过期，新 owner CAS-steal count===0 → 干净落败
  it("CR-1-F1: active lease → CAS steal loses cleanly (count 0, no takeover)", async () => {
    const ck = "cr-lease-active";
    const { team } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id, projectId: "proj-rel-int", environmentId: "env-rel-int",
        name: "lease-active", status: "running", planHash: "h-active",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id, teamId: team.id,
        key: "precheck:active", name: "active", type: "precheck",
        executorKind: "server_command", riskLevel: "low", required: true,
        status: "pending", currentAttempt: 0, concurrencyKey: ck,
        configSnapshot: { command: "echo a" },
      },
    });
    // 预置一个未过期的活跃租约
    await h.prisma.releaseConcurrencyLease.create({
      data: {
        concurrencyKey: ck, releaseStageId: stage.id, attemptId: "live-att",
        owner: "live-owner", acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000), // 仍有效
      },
    });

    const won = await h.prisma.$transaction(async (tx) =>
      h.leaseRepo.acquireWithinTx(tx, {
        concurrencyKey: ck, releaseStageId: stage.id, attemptId: "challenger-att",
        owner: "challenger", expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    expect(won).toBe(false);
    const leases = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leases.length).toBe(1);
    expect(leases[0].owner).toBe("live-owner"); // 原持有者不变
  });

  // CR-1-F1 集成路径：concurrent claim 时一个 owner 持过期租约，另一个 owner 抢占成功
  it("CR-1-F1 integration: concurrent claim with stale lease → exactly one winner via CAS-steal", async () => {
    const ck = "cr-conc-stale";
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "conc-stale", stageKey: "migration:stale", concurrencyKey: ck,
    });
    // 预置过期租约（模拟前一个崩溃 owner 遗留）
    await h.prisma.releaseConcurrencyLease.create({
      data: {
        concurrencyKey: ck, releaseStageId: stage.id, attemptId: "dead-att",
        owner: "dead-owner", acquiredAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() - 30_000),
      },
    });
    await Promise.all([h.coordinator.advancePlan(plan.id), h.coordinator.advancePlan(plan.id)]);
    const leases = await h.prisma.releaseConcurrencyLease.findMany({ where: { concurrencyKey: ck } });
    expect(leases.length).toBe(1);
    expect(leases[0].owner).not.toBe("dead-owner");
    const attempts = await h.prisma.releaseStageAttempt.findMany({ where: { releaseStageId: stage.id } });
    expect(attempts.length).toBe(1);
  });

  // CR-1-F2 / CR-1-F3: finalize 与并发 cancel 竞态——不抛错、stage 保持 canceled、无 stage_finished 事件。
  // cancel 先把 plan/stage/attempt → canceled；finalize 后到，attemptRepo.finish 幂等短路（已终态），
  // 即便进入 finishAttempt，stage CAS 谓词 ["running"] 不匹配 canceled → count===0 → 不写事件。
  it("CR-1-F2/F3: finalize vs concurrent cancel — no throw, stage stays canceled, no finish event", async () => {
    const { plan, stage } = await seedReadyStage(h.prisma, {
      planName: "finalize-vs-cancel", stageKey: "precheck:fvc",
    });
    await h.coordinator.advancePlan(plan.id);
    const attempt = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { releaseStageId: stage.id } });
    const jobId = attempt.serverExecutionJobId as string;

    // 并发 cancel 先把 plan/stage/attempt → canceled
    await h.releasePlanService.cancel("team-rel-int", plan.id, "user-rel-int");
    const attemptAfterCancel = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { id: attempt.id } });
    expect(attemptAfterCancel.status).toBe("canceled"); // cancel 已终态化 attempt

    // finalize 后到：不抛错（finalizeAndAdvance catch 兜底 + finishAttempt CAS count===0）
    await expect(
      h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
        kind: "serverExecutionJob", id: jobId, result: { status: "completed", result: { exitCode: 0 }, logs: [] },
      }),
    ).resolves.toBeUndefined();

    // attempt 保持 cancel 设置的 canceled（finalize 没有把它翻成 succeeded——关键不变式）
    const attemptFinal = await h.prisma.releaseStageAttempt.findFirstOrThrow({ where: { id: attempt.id } });
    expect(attemptFinal.status).toBe("canceled");
    const stageFinal = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(stageFinal?.status).toBe("canceled");
    // 没有为已 canceled 的 stage 追加 stage_finished 事件
    const finishEvents = await h.prisma.releaseEvent.findMany({
      where: { releaseStageId: stage.id, eventType: "release_stage.finished" },
    });
    expect(finishEvents.length).toBe(0);
  });

  // CR-1-F7: retry 与并发 cancel 竞态——retry 事务提交后 re-check plan.status，
  // 若已并发取消则把重开的 stage 翻回 canceled，不留下 ready 阶段困在 canceled 计划下
  it("CR-1-F7: retry vs concurrent cancel — reopened stage reconciled to canceled, no stranded ready", async () => {
    const { team, env } = await seedBaseline(h.prisma);
    const plan = await h.prisma.releasePlan.create({
      data: {
        teamId: team.id, projectId: "proj-rel-int", environmentId: env.id,
        name: "retry-vs-cancel", status: "failed", planHash: "h-rvc",
        finishedAt: new Date(), blockedReason: "存在失败阶段",
      },
    });
    const stage = await h.prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id, teamId: team.id,
        key: "precheck:rvc", name: "rvc", type: "precheck",
        executorKind: "server_command", riskLevel: "low", required: true,
        status: "failed", currentAttempt: 1, configSnapshot: { command: "echo rvc" },
      },
    });
    await h.prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id, teamId: team.id, attemptNo: 1,
        status: "failed", finishedAt: new Date(), error: "boom",
      },
    });

    // 模拟竞态：retryStage 内部事务提交后、advancePlan 之前，并发 cancel 把 plan → canceled。
    // 这里用 monkey-patch coordinator.advancePlan 在 retry 流程中先触发 cancel。
    const origAdvance = h.coordinator.advancePlan.bind(h.coordinator);
    let cancelInjected = false;
    h.coordinator.advancePlan = (async (planId: string, actorId?: string) => {
      if (!cancelInjected) {
        cancelInjected = true;
        // 在 retry 的 post-commit advancePlan 调用中先注入 cancel
        await h.releasePlanService.cancel(team.id, planId, "user-rel-int");
      }
      return origAdvance(planId, actorId);
    }) as never;

    await h.releasePlanService.retryStage(team.id, plan.id, stage.id, "user-rel-int");
    h.coordinator.advancePlan = origAdvance as never;

    // plan 应保持 canceled（cancel 在 retry 之后注入）
    const planFinal = await h.prisma.releasePlan.findUnique({ where: { id: plan.id } });
    expect(planFinal?.status).toBe("canceled");
    // 重开的 stage 不应停留在 ready（被 Fix 8 re-check 翻回 canceled）
    const stageFinal = await h.prisma.releaseStage.findUnique({ where: { id: stage.id } });
    expect(stageFinal?.status).toBe("canceled");
    // 没有额外的 ready 阶段困在 canceled 计划下
    const readyStranded = await h.prisma.releaseStage.findMany({
      where: { releasePlanId: plan.id, status: "ready" },
    });
    expect(readyStranded.length).toBe(0);
  });
});
