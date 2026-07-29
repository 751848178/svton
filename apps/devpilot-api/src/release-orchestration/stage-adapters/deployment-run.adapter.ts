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
import { PrismaService } from "../../prisma/prisma.service";
import { DeploymentService } from "../../deployment/deployment.service";
import type { CreateDeploymentRunDto } from "../../deployment/dto/deployment.dto";
import {
  ReleaseInitializationEvidenceService,
  deploymentInitializationFingerprint,
} from "../../deployment/release-initialization-evidence.service";
import type { ReleaseInitializationEvidenceRef } from "../../deployment/release-initialization-evidence.types";
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
    private readonly prisma: PrismaService,
    private readonly evidenceService: ReleaseInitializationEvidenceService,
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

    // F383 初始化证据桥接：查找同一服务的发布 bootstrap 阶段成功 attempt，
    // 装配可验证的初始化证据引用并落库（幂等）。createRun 侧会从数据库重新读取
    // 并严格校验证据，绝不信任本引用本身。bootstrap 未成功则不携带证据，
    // createRun 会因缺少证据继续走直接部署的 F382 语义或由后续校验 fail-closed。
    const releaseEvidence = await this.resolveInitializationEvidence(ctx);

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
      releaseInitializationEvidence: releaseEvidence ?? undefined,
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

  // 解析发布初始化证据引用（F383 桥接）：
  // 1. 找到同一服务、同一计划、type=bootstrap 且 status=succeeded 的阶段及其成功 attempt；
  // 2. 从 bootstrap 阶段 configSnapshot.command 计算初始化命令指纹；
  // 3. 幂等落库证据（record），返回引用供 createRun 从数据库重新验证。
  // 缺少成功的 bootstrap attempt → 返回 null（不携带证据，由 createRun 侧 fail-closed）。
  private async resolveInitializationEvidence(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseInitializationEvidenceRef | null> {
    if (!ctx.applicationServiceId || !ctx.environmentId) return null;
    const bootstrapStage = await this.prisma.releaseStage.findFirst({
      where: {
        releasePlanId: ctx.releasePlanId,
        applicationServiceId: ctx.applicationServiceId,
        type: "bootstrap",
        status: "succeeded",
      },
      select: { id: true, configSnapshot: true },
    });
    if (!bootstrapStage) return null;
    const bootstrapConfig = isRecord(bootstrapStage.configSnapshot)
      ? bootstrapStage.configSnapshot
      : {};
    const initCommand = readString(bootstrapConfig.command);
    const fingerprint = deploymentInitializationFingerprint(initCommand);
    if (!fingerprint) return null;
    const attempt = await this.prisma.releaseStageAttempt.findFirst({
      where: { releaseStageId: bootstrapStage.id, status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      select: { id: true, serverExecutionJobId: true },
    });
    if (!attempt || !attempt.serverExecutionJobId) return null;
    const ref: ReleaseInitializationEvidenceRef = {
      teamId: ctx.teamId,
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      applicationServiceId: ctx.applicationServiceId,
      releasePlanId: ctx.releasePlanId,
      releaseStageId: bootstrapStage.id,
      releaseStageAttemptId: attempt.id,
      serverExecutionJobId: attempt.serverExecutionJobId,
      commandFingerprint: fingerprint,
    };
    await this.evidenceService.record(ref);
    return ref;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
