/**
 * F383 Item 2 — cancel/finalize CAS 竞态测试的共享 helper（gate / 包装 prisma / harness / seed / assert）。
 *
 * 单一职责：为 release-cancel-cas-race.integration.spec.ts 提供确定性竞态交错所需的测试工具。
 * - deferred：gate 原语（无 timer，确定性）。
 * - GatedPrismaService：Proxy 包装 PrismaService，在 cancel 的 plan CAS 执行前等待 gate，
 *   其余方法透传到真实 prisma。finalize 侧用真实 prisma（不受 gate 影响）。
 * - buildRaceHarness：真实 DB 支持的最小协调器 + cancel service harness（与 release-coordinator
 *   集成 spec 同构，复用其已 export 的 fake 替身）。
 * - seedBaseline / seedRunningPlanWithClaimedStage / assertJointState：构造 running plan + 已认领
 *   stage，并断言 plan/stage/attempt/lease/event 联合不变量。
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
import { ReleaseCancelService } from "./release-cancel.service";
import {
  FakeOperationApprovalService,
  FakeOperationApprovalRepository,
  FakeServerExecutorService,
  FakeServerCommandStageAdapter,
} from "./release-coordinator-test-fakes";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import type { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";

// Deferred：gate 原语（Node < 22 没有 Promise.withResolvers 时仍可用）。
export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// 包装一个 Prisma.TransactionClient：releasePlan.updateMany（cancel 的 CAS）执行前等待 gate。
// 其余方法透传到真实 tx。cancel 的 $transaction 内还会用 releaseStage.updateMany /
// releaseStageAttempt.updateMany / releaseConcurrencyLease.deleteMany / releaseEvent.create，全部透传。
function wrapTxGate(realTx: unknown, gate: { promise: Promise<void> }): unknown {
  return new Proxy(realTx as object, {
    get(target, prop) {
      if (prop === "releasePlan") {
        const rp = Reflect.get(target as object, "releasePlan") as object;
        return new Proxy(rp, {
          get(rpTarget: object, rpProp: string) {
            if (rpProp === "updateMany") {
              return async (args: unknown) => {
                await gate.promise;
                return (rpTarget as { updateMany: (a: unknown) => Promise<unknown> }).updateMany(args);
              };
            }
            const v = Reflect.get(rpTarget, rpProp);
            return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(rpTarget) : v;
          },
        });
      }
      const v = Reflect.get(target as object, prop);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

// 包装 PrismaService：$transaction 注入 gate。其余成员（含 $transaction 外的前置读 / 外部作业取消）
// 透传到真实 prisma。
export class GatedPrismaService {
  constructor(
    private readonly real: PrismaService,
    private readonly gate: { promise: Promise<void> },
  ) {}

  asPrisma(): PrismaService {
    const real = this.real;
    const gate = this.gate;
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "$transaction") {
          return (fn: (tx: never) => Promise<unknown>, ...rest: unknown[]) =>
            (real.$transaction as unknown as (
              f: (tx: never) => Promise<unknown>,
              ...r: unknown[]
            ) => Promise<unknown>)(
              async (realTx: never) => fn(wrapTxGate(realTx, gate) as never),
              ...rest,
            );
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as unknown as PrismaService;
  }
}

export interface RaceHarness {
  prisma: PrismaService;
  coordinator: ReleaseCoordinatorService;
  executor: FakeServerExecutorService;
  cancelService: ReleaseCancelService;
}

export async function buildRaceHarness(): Promise<RaceHarness> {
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
  const healthCheckAdapter = new HealthCheckStageAdapter(
    serverCommandAdapter as unknown as ServerCommandStageAdapter,
  );
  const deploymentRunAdapter = { kind: "deployment_run", execute: async () => ({ status: "queued" as const }) } as never;
  const manualGateAdapter = { kind: "manual_gate", execute: async () => ({ status: "queued" as const }) } as never;
  const coordinator = new ReleaseCoordinatorService(
    prisma, stageRepo, attemptRepo, leaseRepo, planRepo, eventRepo,
    claimService, readiness, recovery, approvalLifecycle,
    serverCommandAdapter as never, deploymentRunAdapter, healthCheckAdapter, manualGateAdapter,
  );
  const cancelService = new ReleaseCancelService(prisma, planRepo, executor as never);
  return { prisma, coordinator, executor, cancelService };
}

export async function seedBaselineRace(prisma: PrismaService) {
  await prisma.releaseConcurrencyLease.deleteMany();
  await prisma.releaseEvent.deleteMany();
  await prisma.releaseStageAttempt.deleteMany();
  await prisma.releaseStageDependency.deleteMany();
  await prisma.releaseStage.deleteMany();
  await prisma.releasePlan.deleteMany();
  await prisma.serverExecutionJob.deleteMany();
  const team = await prisma.team.upsert({
    where: { id: "team-cas-race" },
    update: {},
    create: { id: "team-cas-race", name: "cas-race" },
  });
  const user = await prisma.user.upsert({
    where: { email: "cas-race@test.local" },
    update: {},
    create: { id: "user-cas-race", email: "cas-race@test.local" },
  });
  await prisma.project.upsert({
    where: { id: "proj-cas-race" },
    update: {},
    create: { id: "proj-cas-race", teamId: team.id, createdById: user.id, name: "cas-proj", config: {} },
  });
  const env = await prisma.projectEnvironment.upsert({
    where: { projectId_key: { projectId: "proj-cas-race", key: "prod" } },
    update: {},
    create: { id: "env-cas-race", teamId: team.id, projectId: "proj-cas-race", key: "prod", name: "prod" },
  });
  return { team, user, env };
}

export async function seedRunningPlanWithClaimedStage(
  prisma: PrismaService,
  coordinator: ReleaseCoordinatorService,
  label: string,
) {
  const ck = `cas-${label}`;
  const { team, env } = await seedBaselineRace(prisma);
  const plan = await prisma.releasePlan.create({
    data: {
      teamId: team.id, projectId: "proj-cas-race", environmentId: env.id,
      name: label, status: "running", planHash: `h-${label}`,
    },
  });
  const stage = await prisma.releaseStage.create({
    data: {
      releasePlanId: plan.id, teamId: team.id,
      key: "precheck:" + label, name: label, type: "precheck",
      executorKind: "server_command", riskLevel: "low", required: true,
      status: "ready", currentAttempt: 0, concurrencyKey: ck,
      configSnapshot: { command: "echo " + label },
    },
  });
  await coordinator.advancePlan(plan.id);
  const attempt = await prisma.releaseStageAttempt.findFirstOrThrow({
    where: { releaseStageId: stage.id },
  });
  return { team, env, plan, stage, attempt, ck };
}

export async function assertJointState(
  prisma: PrismaService,
  planId: string,
  opts: {
    planStatus: string;
    stageStatus: string;
    attemptStatus: string;
    leaseCount: number;
    canceledEventCount: number;
  },
) {
  const plan = await prisma.releasePlan.findUniqueOrThrow({ where: { id: planId } });
  expect(plan.status).toBe(opts.planStatus);
  const stages = await prisma.releaseStage.findMany({ where: { releasePlanId: planId } });
  expect(stages.every((s) => s.status === opts.stageStatus)).toBe(true);
  const attempts = await prisma.releaseStageAttempt.findMany({
    where: { releaseStage: { releasePlanId: planId } },
  });
  expect(attempts.every((a) => a.status === opts.attemptStatus)).toBe(true);
  const leases = await prisma.releaseConcurrencyLease.findMany({
    where: { releaseStage: { releasePlanId: planId } },
  });
  expect(leases.length).toBe(opts.leaseCount);
  const events = await prisma.releaseEvent.findMany({
    where: { releasePlanId: planId, eventType: "release_plan.canceled" },
  });
  expect(events.length).toBe(opts.canceledEventCount);
}
