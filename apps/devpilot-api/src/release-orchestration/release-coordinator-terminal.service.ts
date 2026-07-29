/**
 * 发布协调器终态收尾服务（从 release-coordinator.service.ts 抽离，单一职责）。
 *
 * 只负责把一个 attempt 的终态写入数据库：脱敏输出/日志、释放并发租约、消费阶段绑定
 * 审批、两步 CAS 阶段状态转换（CR-1-F2）、追加审计事件。不含编排/认领/适配器路由逻辑。
 *
 * 抽离原因：release-coordinator.service.ts 超过 200 行上限；终态收尾是独立的、可单测的
 * 职责。coordinator 通过组合持有本服务，finishAttempt 在 coordinator 上保留为转发方法以
 * 维持现有调用点（恢复链路、适配器结果处理、public 测试入口）。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import { sanitizeOutputForPersistence } from "./utils/release-output.utils";
import { redactSecretsInObject, redactSecretsInText } from "./utils/release-redact.utils";
import { RELEASE_AUDIT_ACTIONS, type ReleaseStageStatus } from "./types/release-orchestration.types";
import { releaseLeaseOutsideTxNow } from "./release-coordinator-helpers.utils";
import type { ReadinessStageView } from "./release-readiness.service";
import type { AttemptLinkedView } from "./release-recovery.service";
import type { ReleaseStageExecutionResult } from "./stage-adapters/release-stage-adapter.types";

@Injectable()
export class ReleaseCoordinatorTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly approvalLifecycle: ReleaseApprovalLifecycleService,
  ) {}

  // 写入 attempt 终态 + 阶段状态转换 + 事件（单一 choke point，脱敏在此集中 D10）。
  async finishAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    result: ReleaseStageExecutionResult,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    const updated = await this.attemptRepo.finish(attempt.id, {
      status: result.status,
      output: sanitizeOutputForPersistence(result.output ?? null) as never,
      logSummary: redactSecretsInObject(result.logSummary ?? null) as never,
      error: result.error ? redactSecretsInText(result.error) : null,
      finishedAt: new Date(),
    });
    if (updated === 0) return;
    if (stage.concurrencyKey) {
      const leaseOwner = (attempt as { leaseOwner?: string | null }).leaseOwner ?? null;
      await releaseLeaseOutsideTxNow(this.prisma, stage.concurrencyKey, leaseOwner).catch(() => undefined);
    }
    if (result.status === "succeeded" && attempt.operationApprovalId) {
      await this.approvalLifecycle.consume(teamId, attempt.operationApprovalId);
    }
    const nextStageStatus: ReleaseStageStatus =
      result.status === "succeeded" ? "succeeded"
        : result.status === "skipped" ? "skipped" : "failed";
    // CR-1-F2：两步 CAS（谓词即合法性检查）。count===0 表示 stage 已被并发终态化 → 不写事件。
    await this.stageRepo.updateStatusIf(
      stage.id,
      ["pending", "queued", "blocked", "awaiting_approval"],
      { status: "running", blockedReason: null },
    );
    const transition = await this.stageRepo.updateStatusIf(stage.id, ["running"], {
      status: nextStageStatus,
      blockedReason: result.status === "failed" ? result.error ?? null : null,
    });
    if (transition === 0) return;
    await this.eventRepo.append({
      releasePlanId: stage.releasePlanId,
      releaseStageId: stage.id,
      stageAttemptId: attempt.id,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_finished,
      actorId: actorId ?? null,
      summary: `阶段 ${stage.key} ${result.status}`,
      metadata: { status: result.status },
    });
  }
}
