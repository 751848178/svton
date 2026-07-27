/**
 * server_command 阶段适配器：precheck/schema_migration/bootstrap/data_backfill/
 * custom_command/health_check 通过 ServerExecutorService.queueExecution 创建作业。
 * 不新建 SSH/Agent 通道；策略、租约、心跳、恢复全部沿用执行器。
 */
import { Injectable } from "@nestjs/common";
import { ServerExecutorService } from "../../server-executor/server-executor.service";
import { redactSecretsInObject } from "../utils/release-redact.utils";
import { interpretServerCommandResult } from "./release-adapter-interpret.utils";
import type { ServerCommandStep } from "../../server-executor/server-executor.types";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

export { interpretServerCommandResult };

const STAGE_PHASE: Record<string, ServerCommandStep["phase"]> = {
  precheck: "pre_start_check",
  schema_migration: "migration",
  bootstrap: "initialization",
  data_backfill: "deploy", // backfill 复用 deploy 阶段标记
  health_check: "health_check",
  custom_command: "deploy",
};

const STAGE_RISK: Record<string, ServerCommandStep["risk"]> = {
  precheck: "low",
  schema_migration: "high",
  bootstrap: "medium",
  data_backfill: "high",
  health_check: "low",
  custom_command: "medium",
};

@Injectable()
export class ServerCommandStageAdapter implements ReleaseStageAdapter {
  readonly kind = "server_command";

  constructor(private readonly serverExecutor: ServerExecutorService) {}

  async execute(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    // 命令阶段一律排队执行，由 coordinator 恢复链路回读终态
    return this.queue(ctx);
  }

  async queue(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    const cfg = ctx.configSnapshot ?? {};
    const command = readString(cfg.command) ?? readString(cfg.healthCheckUrl);
    if (!command) {
      return {
        status: "failed",
        error: "server_command 阶段缺少 command 配置",
      };
    }
    const stageType = readString(cfg.__stageType) ?? "custom_command";
    const step: ServerCommandStep = {
      key: ctx.releaseStageId,
      label: readString(cfg.__stageName) ?? `release-stage-${ctx.releaseStageId}`,
      command,
      cwd: readString(cfg.workingDirectory),
      required: true,
      risk: STAGE_RISK[stageType] ?? "medium",
      timeoutSeconds: readNumber(cfg.timeoutSeconds),
      phase: STAGE_PHASE[stageType] ?? "deploy",
      runPolicy:
        readString(cfg.runPolicy) === "once_per_environment_command"
          ? "once_per_environment_command"
          : "every_deploy",
      failurePolicy: "block",
    };
    const target = {
      serverId: ctx.serverId ?? null,
      transport: (readString(cfg.transport) ?? "ssh") as "ssh" | "server_agent",
    };
    const result = await this.serverExecutor.queueExecution(
      {
        teamId: ctx.teamId,
        userId: ctx.actorId ?? undefined,
        operationKey: `release_stage.${stageType}`,
        adapterKey: readString(cfg.adapterKey) ?? "ssh-live",
        dryRun: false,
        target: target as never,
        steps: [step],
        metadata: redactSecretsInObject({
          businessRunSync: "release_stage",
          releasePlanId: ctx.releasePlanId,
          releaseStageId: ctx.releaseStageId,
          stageAttemptId: ctx.attemptId,
          operationApprovalId: ctx.operationApprovalId,
          sourceMetadata: {
            projectId: ctx.projectId,
            environmentId: ctx.environmentId,
            applicationId: ctx.applicationId,
            applicationServiceId: ctx.applicationServiceId,
          },
        }),
      },
      { maxAttempts: readNumber(cfg.maxAttempts) ?? 3 },
    );
    return {
      status: "queued",
      serverExecutionJobId: result.serverExecutionJobId,
      logSummary: { queuedAt: result.queuedAt },
    };
  }
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function readNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
