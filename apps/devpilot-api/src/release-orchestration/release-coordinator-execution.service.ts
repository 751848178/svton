/**
 * 发布协调器适配器执行服务（从 release-coordinator.service.ts 抽离，单一职责）。
 *
 * 只负责「认领后的 attempt 如何执行」：装配阶段执行上下文、按阶段类型选择适配器
 * （类型优先路由 D7）、把适配器结果回填到 attempt（关联运行 id）或落终态。不含计划
 * 级编排（advancePlan/finalizeAndAdvance）、终态写库（TerminalService）或恢复逻辑。
 *
 * 抽离原因：release-coordinator.service.ts 超过 200 行上限；适配器执行是独立的、可单测
 * 的职责。coordinator 通过组合持有本服务。
 */
import { Injectable } from "@nestjs/common";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseReadinessService, type ReadinessStageView } from "./release-readiness.service";
import { ReleaseCoordinatorTerminalService } from "./release-coordinator-terminal.service";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { DeploymentRunStageAdapter } from "./stage-adapters/deployment-run.adapter";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import { ManualGateStageAdapter } from "./stage-adapters/manual-gate.adapter";
import { redactSecretsInText } from "./utils/release-redact.utils";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";
import type { AttemptLinkedView } from "./release-recovery.service";

@Injectable()
export class ReleaseCoordinatorExecutionService {
  constructor(
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly terminal: ReleaseCoordinatorTerminalService,
    private readonly serverCommandAdapter: ServerCommandStageAdapter,
    private readonly deploymentRunAdapter: DeploymentRunStageAdapter,
    private readonly healthCheckAdapter: HealthCheckStageAdapter,
    private readonly manualGateAdapter: ManualGateStageAdapter,
  ) {}

  // 认领 attempt 并调用适配器（claim 已在事务内把 attempt 置 queued + 写租约）。
  async startAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    await this.stageRepo.updateStatusIf(stage.id, ["queued"], {
      status: "running",
      blockedReason: null,
      currentAttempt: attempt.attemptNo,
    });
    const ctx: ReleaseStageExecutionContext = {
      releasePlanId: stage.releasePlanId,
      releaseStageId: stage.id,
      attemptId: attempt.id,
      teamId,
      projectId: stage.releasePlan.projectId,
      environmentId: stage.releasePlan.environmentId,
      applicationId: stage.applicationId,
      applicationServiceId: stage.applicationServiceId,
      serverId: stage.serverId ?? null,
      stageKey: stage.key ?? null,
      stageType: stage.type ?? null,
      configSnapshot: enrichConfig(stage),
      configHash: stage.configHash ?? null,
      actorId: actorId ?? null,
      operationApprovalId: attempt.operationApprovalId ?? null,
    };
    const adapter = this.selectAdapter(stage);
    try {
      const result = await adapter.execute(ctx);
      await this.handleAdapterResult(stage, attempt, result, teamId, actorId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.terminal.finishAttempt(stage, attempt, {
        status: "failed",
        error: redactSecretsInText(msg),
      }, teamId, actorId);
    }
  }

  // 类型优先路由（D7）：health_check 必须走 HealthCheckStageAdapter（构造 sanitized curl）。
  selectAdapter(stage: { type: string; executorKind: string }): ReleaseStageAdapter {
    if (stage.type === "health_check") return this.healthCheckAdapter;
    switch (stage.executorKind) {
      case "deployment_run":
        return this.deploymentRunAdapter;
      case "manual_gate":
        return this.manualGateAdapter;
      case "server_command":
      case "shell":
      default:
        return this.serverCommandAdapter;
    }
  }

  // 适配器返回 queued 时只回填关联运行 id；终态由恢复链路回读。
  private async handleAdapterResult(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    result: ReleaseStageExecutionResult,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    if (result.serverExecutionJobId || result.deploymentRunId || result.operationApprovalId) {
      const linkData: {
        deploymentRunId?: string | null;
        serverExecutionJobId?: string | null;
        operationApprovalId?: string | null;
      } = {};
      if (result.deploymentRunId !== undefined) linkData.deploymentRunId = result.deploymentRunId;
      if (result.serverExecutionJobId !== undefined) linkData.serverExecutionJobId = result.serverExecutionJobId;
      if (result.operationApprovalId !== undefined) linkData.operationApprovalId = result.operationApprovalId;
      await this.attemptRepo.linkRun(attempt.id, linkData);
    }
    if (result.status === "succeeded" || result.status === "failed" || result.status === "skipped") {
      await this.terminal.finishAttempt(stage, attempt, result, teamId, actorId);
    }
  }
}

// 阶段配置补充：把 stageType/stageName 注入 configSnapshot，供 adapter 路由
function enrichConfig(stage: ReadinessStageView): Record<string, unknown> {
  const base = (stage.configSnapshot ?? {}) as Record<string, unknown>;
  return { ...base, __stageType: stage.type, __stageName: stage.name };
}
