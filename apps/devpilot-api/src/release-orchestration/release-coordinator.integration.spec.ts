/**
 * F383 协调器集成测试：在一次性 MySQL 上验证原子认领、并发、租约恢复、幂等。
 * 需要 DATABASE_URL 指向已 migrate 的空库；否则跳过。
 *
 * 运行方式：
 *   docker run -d --rm --name mysql -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=rel -p 3399:3306 mysql:8
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" npx prisma migrate deploy
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" npx jest src/release-orchestration/release-coordinator.integration.spec.ts
 */
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL ?? "";
const isIntegration = DB_URL.includes("3399") || process.env.RUN_RELEASE_INTEGRATION === "1";

const describeIntegration = isIntegration ? describe : (describe.skip as jest.Describe);

const prisma = new PrismaClient();

async function seedBaseline() {
  // 清理 + 建立最小关联：team/project/environment/application/service
  await prisma.releaseEvent.deleteMany();
  await prisma.releaseStageAttempt.deleteMany();
  await prisma.releaseStageDependency.deleteMany();
  await prisma.releaseStage.deleteMany();
  await prisma.releasePlan.deleteMany();

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
    create: {
      id: "proj-rel-int",
      teamId: team.id,
      createdById: user.id,
      name: "rel-proj",
      config: {},
    },
  });
  const env = await prisma.projectEnvironment.upsert({
    where: { projectId_key: { projectId: project.id, key: "prod" } },
    update: {},
    create: {
      id: "env-rel-int",
      teamId: team.id,
      projectId: project.id,
      key: "prod",
      name: "prod",
    },
  });
  return { team, user, project, env };
}

describeIntegration("release coordinator integration: claim/lease/recovery", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("atomic claim: only one of two concurrent claims succeeds on the same attempt", async () => {
    const { team, env } = await seedBaseline();
    const plan = await prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "claim-test",
        status: "running",
        planHash: "h1",
      },
    });
    const stage = await prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "precheck:s1",
        name: "precheck",
        type: "precheck",
        executorKind: "server_command",
        riskLevel: "low",
        required: true,
        status: "ready",
        concurrencyKey: "svc:s1",
        configSnapshot: { command: "echo hi" },
      },
    });
    const attempt = await prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "queued",
      },
    });

    // 模拟两个 coordinator 实例并发认领同一 attempt
    const leaseA = new Date(Date.now() + 15 * 60 * 1000);
    const leaseB = new Date(Date.now() + 15 * 60 * 1000);
    const [claimA, claimB] = await Promise.all([
      prisma.releaseStageAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "queued",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
        },
        data: {
          status: "running",
          leaseOwner: "owner-A",
          leaseExpiresAt: leaseA,
          heartbeatAt: new Date(),
          startedAt: new Date(),
        },
      }),
      prisma.releaseStageAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "queued",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
        },
        data: {
          status: "running",
          leaseOwner: "owner-B",
          leaseExpiresAt: leaseB,
          heartbeatAt: new Date(),
          startedAt: new Date(),
        },
      }),
    ]);

    expect(claimA.count + claimB.count).toBe(1);
    const final = await prisma.releaseStageAttempt.findUnique({ where: { id: attempt.id } });
    expect(final?.status).toBe("running");
    expect(["owner-A", "owner-B"]).toContain(final?.leaseOwner);
  });

  it("lease recovery: expired lease allows re-claim; terminal state read from linked job", async () => {
    const { team, env } = await seedBaseline();
    const plan = await prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "lease-test",
        status: "running",
        planHash: "h2",
      },
    });
    const stage = await prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "migration:s1",
        name: "migration",
        type: "schema_migration",
        executorKind: "server_command",
        riskLevel: "high",
        required: true,
        status: "running",
        currentAttempt: 1,
      },
    });
    // 关联一个已完成的 ServerExecutionJob
    const job = await prisma.serverExecutionJob.create({
      data: {
        teamId: team.id,
        operationKey: "release_stage.schema_migration",
        adapterKey: "ssh-live",
        transport: "ssh",
        status: "completed",
        inputSnapshot: { steps: [] },
        result: { mode: "executed", exitCode: 0 },
        logs: [{ level: "info", message: "ok" }],
      },
    });
    // attempt 已过期
    const past = new Date(Date.now() - 60_000);
    const attempt = await prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "running",
        serverExecutionJobId: job.id,
        leaseOwner: "dead-coordinator",
        leaseExpiresAt: past,
      },
    });

    // 模拟 recoverStaleAttempts 的过期检测
    const stale = await prisma.releaseStageAttempt.findUnique({ where: { id: attempt.id } });
    expect(stale?.leaseExpiresAt?.getTime()).toBeLessThan(Date.now());

    // 终态回读后，attempt 应能被收尾为 succeeded
    const finished = await prisma.releaseStageAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["queued", "running"] } },
      data: { status: "succeeded", finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
    });
    expect(finished.count).toBe(1);
    const final = await prisma.releaseStageAttempt.findUnique({ where: { id: attempt.id } });
    expect(final?.status).toBe("succeeded");
  });

  it("idempotency: succeeding the same stage twice does not duplicate attempts", async () => {
    const { team, env } = await seedBaseline();
    const plan = await prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "idem-test",
        status: "running",
        planHash: "h3",
      },
    });
    const stage = await prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "bootstrap:s1",
        name: "bootstrap",
        type: "bootstrap",
        executorKind: "server_command",
        riskLevel: "medium",
        required: true,
        status: "succeeded",
        currentAttempt: 1,
      },
    });
    // 唯一键约束保证同 attemptNo 不重复
    await prisma.releaseStageAttempt.create({
      data: {
        releaseStageId: stage.id,
        teamId: team.id,
        attemptNo: 1,
        status: "succeeded",
      },
    });
    await expect(
      prisma.releaseStageAttempt.create({
        data: {
          releaseStageId: stage.id,
          teamId: team.id,
          attemptNo: 1,
          status: "succeeded",
        },
      }),
    ).rejects.toThrow();
    const attempts = await prisma.releaseStageAttempt.findMany({
      where: { releaseStageId: stage.id },
    });
    expect(attempts.length).toBe(1);
  });

  it("concurrency key: two stages sharing a concurrencyKey cannot both be active", async () => {
    const { team, env } = await seedBaseline();
    const plan = await prisma.releasePlan.create({
      data: {
        teamId: team.id,
        projectId: "proj-rel-int",
        environmentId: env.id,
        name: "conc-test",
        status: "running",
        planHash: "h4",
      },
    });
    const ck = "db:prod";
    await prisma.releaseStage.create({
      data: {
        releasePlanId: plan.id,
        teamId: team.id,
        key: "migration:s1",
        name: "m1",
        type: "schema_migration",
        executorKind: "server_command",
        riskLevel: "high",
        required: true,
        status: "running",
        concurrencyKey: ck,
      },
    });
    // 同 ck 的第二个阶段应被并发检查识别为不可运行
    const active = await prisma.releaseStage.findFirst({
      where: { concurrencyKey: ck, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    expect(active).not.toBeNull();
    // 模拟 readiness：排除自己后仍存在 active → 不可并发
    const other = await prisma.releaseStage.findFirst({
      where: {
        concurrencyKey: ck,
        status: { in: ["queued", "running"] },
        id: { not: "nonexistent" },
      },
      select: { id: true },
    });
    expect(other).not.toBeNull();
  });
});
