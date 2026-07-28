/**
 * deployment_run 阶段适配器：通过 DeploymentService.createRun 内部创建 DeploymentRun。
 * 不走 HTTP 自调用；releaseApplicationOnly=true 跳过 F382 串行前置阶段。
 *
 * F383 P0-B：发布阶段审批（category=release_plan）与部署审批（category=deployment）
 * 上下文不兼容。若 ctx 携带发布阶段审批 id，先经 ReleaseDeploymentApprovalBridgeService
 * 严格校验父审批并派生一个匹配 deployment 上下文的审批，再交给 createRun。
 * 不放宽 OperationApprovalMatchService 的严格匹配。
 */
import { Injectable } from "@nestjs/common";
import { DeploymentService } from "../../deployment/deployment.service";
import type { CreateDeploymentRunDto } from "../../deployment/dto/deployment.dto";
import { ReleaseDeploymentApprovalBridgeService } from "../release-deployment-approval-bridge.service";
import { interpretDeploymentRunResult } from "./release-adapter-interpret.utils";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

export { interpretDeploymentRunResult };

@Injectable()
export class DeploymentRunStageAdapter implements ReleaseStageAdapter {
  readonly kind = "deployment_run";

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly approvalBridge: ReleaseDeploymentApprovalBridgeService,
  ) {}

  async execute(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    const cfg = ctx.configSnapshot ?? {};
    if (!ctx.applicationServiceId && !ctx.applicationId) {
      return {
        status: "failed",
        error: "application_deploy 阶段缺少 applicationServiceId",
      };
    }
    // P0-B：把发布阶段审批桥接为 deployment 类审批（若存在发布阶段审批 id）。
    const deploymentApprovalId = await this.resolveDeploymentApproval(ctx);

    const dto: CreateDeploymentRunDto = {
      environmentId: ctx.environmentId ?? undefined,
      applicationId: ctx.applicationId ?? undefined,
      applicationServiceId: ctx.applicationServiceId ?? undefined,
      serverId: ctx.serverId ?? undefined,
      branch: readString(cfg.branch),
      commitSha: readString(cfg.commitSha),
      source: "api",
      trigger: "api",
      dryRun: false,
      queue: true, // 应用部署一律排队，coordinator 从关联 run 回读终态
      approvalId: deploymentApprovalId ?? undefined,
      // 关键：发布编排已独立执行 migration/bootstrap，应用部署不重复
      releaseApplicationOnly: true,
      overrides: cfg.overrides as Record<string, unknown> | undefined,
    };
    const run = (await this.deploymentService.createRun(
      ctx.teamId,
      ctx.actorId ?? undefined,
      ctx.projectId,
      dto,
    )) as { id: string; status: string; operationApprovalId?: string | null };

    return {
      status: run.status === "completed" ? "succeeded" : "queued",
      deploymentRunId: run.id,
      operationApprovalId: run.operationApprovalId ?? null,
      // logSummary redaction centralized in coordinator.finishAttempt (D10)
      logSummary: { deploymentRunStatus: run.status },
    };
  }

  // 解析可用于 createRun 的 deployment 审批 id：
  // - 有发布阶段审批 id → 桥接派生（严格校验父审批 + scope + inputHash）
  // - 否则 undefined（createRun 会按自身规则创建 pending 并 block）
  private async resolveDeploymentApproval(
    ctx: ReleaseStageExecutionContext,
  ): Promise<string | null> {
    if (!ctx.operationApprovalId) return null;
    return this.approvalBridge.deriveDeploymentApproval({
      teamId: ctx.teamId,
      releaseApprovalId: ctx.operationApprovalId,
      stage: {
        id: ctx.releaseStageId,
        releasePlanId: ctx.releasePlanId,
        key: ctx.stageKey ?? "",
        type: ctx.stageType ?? "",
        applicationId: ctx.applicationId ?? null,
        applicationServiceId: ctx.applicationServiceId ?? null,
        environmentId: ctx.environmentId ?? null,
        serverId: ctx.serverId ?? null,
        configHash: ctx.configHash ?? null,
      },
      plan: {
        id: ctx.releasePlanId,
        projectId: ctx.projectId,
        environmentId: ctx.environmentId,
        name: readString(ctx.configSnapshot?.__planName) ?? ctx.releasePlanId,
      },
      deploymentContext: {
        projectId: ctx.projectId,
        environmentId: ctx.environmentId,
        applicationId: ctx.applicationId,
        applicationServiceId: ctx.applicationServiceId,
        serverId: ctx.serverId,
        targetType: "project",
        action: "deployment.run",
        risk: "medium",
      },
    });
  }
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
