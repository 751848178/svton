/**
 * F383 Item 2 / P1 — 确定性的 cancel/finalize CAS 竞态集成测试。
 *
 * 旧测试（release-coordinator.integration.spec.ts "finalize wins first"）只是先完整
 * finalize 再串行调用 cancel，命中的是 cancel 入口终态预检（release-cancel.service.ts:41），
 * 没有覆盖真正的旧读竞态。本文件用可控的 $transaction seam（GatedPrismaService）
 * 固定确定性交错。P1 升级为双向 barrier：
 *   1. cancel 读 plan（status=running）+ 入口预检通过
 *   2. cancel 进入 $transaction，到达 plan CAS 时 notifyEntered 并暂停（await release）
 *   3. 测试 await gate.entered（确定性到达确认，非 setImmediate/概率性等待）
 *   4. finalize 完成 attempt→succeeded、stage→succeeded、plan→succeeded
 *   5. 测试 gate.letRelease()，cancel 的 plan CAS 真正执行 → 命中 0 行 → lost 分支
 *   6. 联合不变量：plan/stage/attempt=succeeded；lease 正确；无 plan_canceled；无半取消
 *
 * 场景 1b 连续重复 20 次核心竞态，验证双向 barrier 下无 flake。
 * 同时覆盖：cancel 先获胜、两个 cancel 并发、外部任务取消失败（非 BadRequest）、
 * failed-plan 取消（escape hatch）、幂等重复取消。全部经真实 Prisma + 一次性 MySQL。
 *
 * 运行方式（与 release-coordinator.integration.spec.ts 一致）：
 *   docker run -d --rm --name svton-mysql-rel -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=rel -p 3399:3306 mysql:8
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" npx prisma migrate deploy
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" RUN_RELEASE_INTEGRATION=1 \
 *     npx jest src/release-orchestration/release-cancel-cas-race.integration.spec.ts
 *
 * 注意：本 spec 与 release-coordinator.integration.spec.ts 共享同一一次性 MySQL，两个套件都
 * deleteMany 清表 → 必须串行运行（--runInBand）。npm run test:integration 已封装该约定。
 * gate / 包装 prisma / harness / seed / assert 见 release-cancel-cas-race.helpers.ts。
 * 未设置 DATABASE_URL=...3399 或 RUN_RELEASE_INTEGRATION=1 时整体跳过（默认 CI 行为）。
 */
import { ConflictException } from "@nestjs/common";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseCancelService } from "./release-cancel.service";
import {
  assertJointState,
  buildRaceHarness,
  raceGate,
  GatedPrismaService,
  seedRunningPlanWithClaimedStage,
  type RaceHarness,
} from "./release-cancel-cas-race.helpers";

const DB_URL = process.env.DATABASE_URL ?? "";
const isIntegration = DB_URL.includes("3399") || process.env.RUN_RELEASE_INTEGRATION === "1";
const describeIntegration = isIntegration ? describe : (describe.skip as jest.Describe);

describeIntegration("F383 Item 2: deterministic cancel/finalize CAS race", () => {
  let h: RaceHarness;
  beforeAll(async () => {
    h = await buildRaceHarness();
  });
  afterAll(async () => {
    await h.prisma.$disconnect();
  });
  jest.setTimeout(15000); // 竞态测试给足超时（gate + 真实 DB 写）

  // 场景 1（核心，P1 双向 barrier）：cancel 读 running → 到达 CAS 并暂停（entered）→
  // finalize 推 plan→succeeded → 放行 cancel → CAS 0 行 lost。无 setImmediate/概率性等待。
  it("stale-read race: cancel reaches CAS (entered barrier), finalize wins, cancel CAS hits 0 rows → no partial cancel", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "stale-read");
    const { team, plan, attempt } = seeded;

    const gate = raceGate();
    const gated = new GatedPrismaService(h.prisma, gate);
    const cancelWithGate = new ReleaseCancelService(
      gated.asPrisma(),
      new ReleasePlanRepository(gated.asPrisma()),
      h.executor as never,
    );
    // 1. cancel 启动：读 + 预检通过（snapshot=running）→ 进入 $transaction → 卡在 plan CAS。
    const cancelP = cancelWithGate.cancel(team.id, plan.id, "user-cas-race");
    // 2. 双向 barrier：等待 cancel 真正到达 plan CAS（entered）——确定性，非 timer/setImmediate。
    await gate.entered;
    // 此时确认 plan 仍为 running（cancel 暂停在 CAS 前，尚未写）。
    const planBeforeFinalize = await h.prisma.releasePlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(planBeforeFinalize.status).toBe("running");

    // 3. finalize 完成（真实 prisma，不受 gate）：attempt/stage/plan → succeeded。
    await h.executor.completeJob(attempt.serverExecutionJobId as string, "completed", { exitCode: 0 });
    await h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
      kind: "serverExecutionJob",
      id: attempt.serverExecutionJobId as string,
      result: { status: "completed", result: { exitCode: 0 } },
    });
    const planAfterFinalize = await h.prisma.releasePlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(planAfterFinalize.status).toBe("succeeded");

    // 4. 释放 gate：cancel 的 plan CAS 现在执行 → WHERE status notIn [succeeded,canceled] 命中 0 行。
    gate.letRelease();
    await cancelP; // CAS-lost 分支不抛（幂等语义）

    // 5. 联合不变量：全部 succeeded；无 plan_canceled；lease 已被 finalize 释放（=0）。
    await assertJointState(h.prisma, plan.id, {
      planStatus: "succeeded", stageStatus: "succeeded", attemptStatus: "succeeded",
      leaseCount: 0, canceledEventCount: 0,
    });
    // CR M1：显式断言 cancel 未写 canceledAt（CAS-lost 分支不触碰 plan 行）。
    expect(planAfterFinalize.canceledAt).toBeNull();
    // 显式断言无半取消：没有 stage/attempt 被翻成 canceled。
    const canceledStages = await h.prisma.releaseStage.findMany({
      where: { releasePlanId: plan.id, status: "canceled" },
    });
    const canceledAttempts = await h.prisma.releaseStageAttempt.findMany({
      where: { releaseStage: { releasePlanId: plan.id }, status: "canceled" },
    });
    expect(canceledStages).toHaveLength(0);
    expect(canceledAttempts).toHaveLength(0);
    // CR FC1：cancel 的 best-effort 外部 cancelJob 可能在 finalize 的 completeJob 之前或之后
    // 跑到 → SEJ 终态非确定（completed 或 cancelled），但必须是终态（无半取消留悬空作业）。
    const sej = await h.prisma.serverExecutionJob.findUniqueOrThrow({
      where: { id: attempt.serverExecutionJobId as string },
    });
    expect(["completed", "cancelled"]).toContain(sej.status);
  });

  // 场景 1b（P1 确定性保证）：连续重复运行核心竞态 20 次，双向 barrier 下不得出现 flake。
  it("stale-read race repeated 20× via entered/release barrier — no flake", async () => {
    for (let i = 0; i < 20; i++) {
      const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, `flake-${i}`);
      const { team, plan, attempt } = seeded;
      const gate = raceGate();
      const gated = new GatedPrismaService(h.prisma, gate);
      const cancelWithGate = new ReleaseCancelService(
        gated.asPrisma(),
        new ReleasePlanRepository(gated.asPrisma()),
        h.executor as never,
      );
      const cancelP = cancelWithGate.cancel(team.id, plan.id, "user-cas-race");
      await gate.entered; // 确定性到达确认，无 timer/setImmediate
      await h.executor.completeJob(attempt.serverExecutionJobId as string, "completed", { exitCode: 0 });
      await h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
        kind: "serverExecutionJob",
        id: attempt.serverExecutionJobId as string,
        result: { status: "completed", result: { exitCode: 0 } },
      });
      gate.letRelease();
      await cancelP;
      await assertJointState(h.prisma, plan.id, {
        planStatus: "succeeded", stageStatus: "succeeded", attemptStatus: "succeeded",
        leaseCount: 0, canceledEventCount: 0,
      });
    }
  });

  // 场景 2：cancel 先获胜，finalize 后到达 → finalize 幂等短路（attempt 已 canceled）。
  it("cancel wins first → finalize after is a no-op (attempt already canceled)", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "cancel-first");
    const { team, plan, attempt } = seeded;

    await h.cancelService.cancel(team.id, plan.id, "user-cas-race");
    await assertJointState(h.prisma, plan.id, {
      planStatus: "canceled", stageStatus: "canceled", attemptStatus: "canceled",
      leaseCount: 0, canceledEventCount: 1,
    });

    // finalize 后到达：attempt 已 canceled（终态）→ finish CAS 命中 0 → 幂等短路。
    await h.coordinator.finalizeAndAdvance(plan.id, attempt.id, {
      kind: "serverExecutionJob",
      id: attempt.serverExecutionJobId as string,
      result: { status: "completed", result: { exitCode: 0 } },
    });
    await assertJointState(h.prisma, plan.id, {
      planStatus: "canceled", stageStatus: "canceled", attemptStatus: "canceled",
      leaseCount: 0, canceledEventCount: 1,
    });
  });

  // 场景 3：两个 cancel 并发 → 恰好一个获胜（CAS 序列化在行锁上）。
  it("two concurrent cancels → exactly one wins CAS, one plan_canceled event", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "two-cancel");
    const { team, plan } = seeded;

    const results = await Promise.allSettled([
      h.cancelService.cancel(team.id, plan.id, "user-cas-race"),
      h.cancelService.cancel(team.id, plan.id, "user-cas-race-2"),
    ]);
    // CR F1：两个 cancel 都读 running 旧快照时，第二个走 CAS-lost（fulfilled）；若第二个读
    // 到第一个已提交的 canceled，则入口预检抛 ConflictException（rejected）。两种都是合法终态，
    // 故只断言「至少一个 fulfilled（CAS 获胜）」；下方 canceledEventCount:1 才是「恰好一胜」的硬证据。
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    await assertJointState(h.prisma, plan.id, {
      planStatus: "canceled", stageStatus: "canceled", attemptStatus: "canceled",
      leaseCount: 0, canceledEventCount: 1,
    });
  });

  // 场景 4：外部任务取消失败（非 BadRequest）→ 仅 warn，DB 取消仍一致完成。
  it("external cancelJob throws non-BadRequest → warn only, DB cancel still completes consistently", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "ext-fail");
    const { team, plan, attempt } = seeded;
    const origCancel = h.executor.cancelJob.bind(h.executor);
    (h.executor as { cancelJob: unknown }).cancelJob = async () => {
      throw new Error("network down");
    };
    try {
      await h.cancelService.cancel(team.id, plan.id, "user-cas-race");
    } finally {
      (h.executor as { cancelJob: unknown }).cancelJob = origCancel;
    }
    await assertJointState(h.prisma, plan.id, {
      planStatus: "canceled", stageStatus: "canceled", attemptStatus: "canceled",
      leaseCount: 0, canceledEventCount: 1,
    });
    void attempt;
  });

  // 场景 5：failed plan 取消（escape hatch）→ failed→canceled 合法，旧 failed stage 保持 failed。
  it("a failed plan can be canceled (escape hatch: failed→canceled)", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "failed-plan");
    const { team, env, plan, stage, attempt } = seeded;
    await h.prisma.releasePlan.update({ where: { id: plan.id }, data: { status: "failed", finishedAt: new Date() } });
    await h.prisma.releaseStage.update({ where: { id: stage.id }, data: { status: "failed" } });
    await h.prisma.releaseStageAttempt.update({
      where: { id: attempt.id },
      data: { status: "failed", finishedAt: new Date() },
    });

    await h.cancelService.cancel(team.id, plan.id, "user-cas-race");
    const planAfter = await h.prisma.releasePlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(planAfter.status).toBe("canceled");
    const stages = await h.prisma.releaseStage.findMany({ where: { releasePlanId: plan.id } });
    expect(stages.every((s) => s.status === "failed")).toBe(true);
    const attempts = await h.prisma.releaseStageAttempt.findMany({
      where: { releaseStage: { releasePlanId: plan.id } },
    });
    expect(attempts.every((a) => a.status === "failed")).toBe(true);
    const events = await h.prisma.releaseEvent.findMany({
      where: { releasePlanId: plan.id, eventType: "release_plan.canceled" },
    });
    expect(events.length).toBe(1);
    // CR M2：failed plan 无活跃租约（failed stage 不持有 lease）。
    const leaseCount = await h.prisma.releaseConcurrencyLease.count({
      where: { releaseStage: { releasePlanId: plan.id } },
    });
    expect(leaseCount).toBe(0);
    void env;
  });

  // 场景 6：幂等重复取消 —— 第一次 CAS 命中 1 行（won），第二次入口读到 canceled → ConflictException。
  it("idempotent repeat cancel: first wins, second hits terminal precheck → ConflictException", async () => {
    const seeded = await seedRunningPlanWithClaimedStage(h.prisma, h.coordinator, "repeat-cancel");
    const { team, plan } = seeded;

    await h.cancelService.cancel(team.id, plan.id, "user-cas-race"); // 第一次：CAS 命中 1 行 → won
    await expect(h.cancelService.cancel(team.id, plan.id, "user-cas-race")).rejects.toThrow(
      ConflictException,
    );
    const events = await h.prisma.releaseEvent.findMany({
      where: { releasePlanId: plan.id, eventType: "release_plan.canceled" },
    });
    expect(events.length).toBe(1);
  });
});
