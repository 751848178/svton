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
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";

const DB_URL = process.env.DATABASE_URL ?? "";
const isIntegration = DB_URL.includes("3399") || process.env.RUN_RELEASE_INTEGRATION === "1";
const describeIntegration = isIntegration ? describe : (describe.skip as jest.Describe);

// 测试专用 ServerExecutorService 替身：queueExecution 写一行真实 ServerExecutionJob；
// cancelJob 把作业置 cancelled；completeJob 模拟回调完成。
class FakeServerExecutorService {
  readonly kind = "server_command";
  constructor(private readonly prisma: PrismaService) {}
  async queueExecution(
    input: { teamId: string; operationKey?: string; adapterKey?: string; metadata?: unknown },
  ): Promise<{ serverExecutionJobId: string; queuedAt: Date }> {
    const job = await this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        operationKey: input.operationKey ?? "release_stage.test",
        adapterKey: input.adapterKey ?? "ssh-live",
        transport: "ssh",
        status: "queued",
        inputSnapshot: { steps: [] },
        metadata: input.metadata as never,
      },
    });
    return { serverExecutionJobId: job.id, queuedAt: job.queuedAt };
  }
  async cancelJob(_teamId: string, _userId: string, id: string): Promise<void> {
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
    const r = await this.executor.queueExecution({
      teamId: ctx.teamId,
      operationKey: `release_stage.${(ctx.configSnapshot as { __stageType?: string } | null)?.__stageType ?? "test"}`,
      adapterKey: "ssh-live",
      metadata: {
        businessRunSync: "release_stage",
        releasePlanId: ctx.releasePlanId,
        releaseStageId: ctx.releaseStageId,
        stageAttemptId: ctx.attemptId,
      },
    });
    return { status: "queued", serverExecutionJobId: r.serverExecutionJobId, logSummary: { queuedAt: r.queuedAt } };
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

interface Harness {
  prisma: PrismaService;
  coordinator: ReleaseCoordinatorService;
  executor: FakeServerExecutorService;
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
    manualGateAdapter,
  );
  return { prisma, coordinator, executor };
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
});
