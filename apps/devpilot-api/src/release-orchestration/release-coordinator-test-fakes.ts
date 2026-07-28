/**
 * F383 — 发布协调器集成测试共享替身（test-only，非 spec 文件，不被 jest testRegex 识别为套件）。
 *
 * 单一职责：提供 FakeServerExecutorService / FakeServerCommandStageAdapter /
 * FakeOperationApprovalService / FakeOperationApprovalRepository。这两个集成 spec 复用：
 * - release-coordinator.integration.spec.ts
 * - release-cancel-cas-race.integration.spec.ts
 *
 * 历史原因：原先这 4 个类内联在 release-coordinator.integration.spec.ts 中，当第二个 spec
 * import 它们以复用时，jest 的 testRegex(.*\.spec\.ts$) 会把被 import 的 spec 文件也当作
 * 独立套件运行两次，两个套件并发写同一个 DB → 行数翻倍/flaky。抽到非 spec 文件消除重复运行。
 */
import { PrismaService } from "../prisma/prisma.service";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";

// 测试专用 ServerExecutorService 替身：queueExecution 写一行真实 ServerExecutionJob；
// cancelJob 把作业置 cancelled；completeJob 模拟回调完成。
// cancelJob 调用记录到 cancelledJobIds 数组，供取消场景断言。
export class FakeServerExecutorService {
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
export class FakeServerCommandStageAdapter implements ReleaseStageAdapter {
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

// OperationApprovalService 替身：createPending 自动 approved，findLatestForTarget 返回 approved
export class FakeOperationApprovalService {
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
export class FakeOperationApprovalRepository {
  async findLatestForTarget(): Promise<null> { return null; }
  async cancel(): Promise<number> { return 0; }
}
