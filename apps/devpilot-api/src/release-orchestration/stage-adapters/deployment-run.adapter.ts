/**
 * deployment_run 阶段适配器：通过 DeploymentService.createRun 内部创建 DeploymentRun。
 * 不走 HTTP 自调用；releaseApplicationOnly=true 跳过 F382 串行前置阶段。
 */
import { Injectable } from "@nestjs/common";
import { DeploymentService } from "../../deployment/deployment.service";
import type { CreateDeploymentRunDto } from "../../deployment/dto/deployment.dto";
import { redactSecretsInObject } from "../utils/release-redact.utils";
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

  constructor(private readonly deploymentService: DeploymentService) {}

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
      approvalId: ctx.operationApprovalId ?? undefined,
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
      logSummary: redactSecretsInObject({ deploymentRunStatus: run.status }),
    };
  }
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
