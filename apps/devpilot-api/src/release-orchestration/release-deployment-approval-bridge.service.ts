/**
 * 发布阶段审批 → 部署审批的安全桥接（F383 P0-B）。
 *
 * 问题：Release Stage Approval 绑定 category=release_plan / targetType=release_stage /
 * inputHash=<configHash 派生值>；但 DeploymentService.createRun 要求
 * category=deployment / action=deployment.run / targetType=project / inputHash=null。
 * OperationApprovalMatchService.assertMatches 严格匹配，两者必然不匹配。
 *
 * 桥接语义（不放宽严格匹配，不依赖前端布尔，不硬编码绕过）：
 *   1. 重新加载父发布阶段审批并用纯谓词 assertParentApprovalBridgable 严格校验
 *      （status/未消费/未过期/target/inputHash/scope 全部匹配）。
 *   2. 派生一个 deployment 类审批（直接 approved），metadata 记录父审批链路。
 *   3. 幂等：同父审批 + 同部署上下文已派生过则复用，不重复生成。
 * 失败一律 fail-closed；不修改 OperationApprovalMatchService；非发布场景审批语义不变。
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OperationApprovalRepository } from "../operation-approval/operation-approval.repository";
import {
  BRIDGE_REVIEWER_MARKER,
  assertParentApprovalBridgable,
  type ApprovalBridgeMetadata,
  type ParentApprovalRow,
} from "./release-deployment-approval-bridge.types";

export interface DeriveDeploymentApprovalInput {
  teamId: string;
  releaseApprovalId: string;
  stage: {
    id: string;
    releasePlanId: string;
    key: string;
    type: string;
    applicationId?: string | null;
    applicationServiceId?: string | null;
    environmentId?: string | null;
    serverId?: string | null;
    configHash?: string | null;
  };
  plan: { id: string; projectId: string; environmentId: string; name: string };
  deploymentContext: {
    projectId: string;
    environmentId?: string | null;
    applicationId?: string | null;
    applicationServiceId?: string | null;
    serverId?: string | null;
    targetType: string;
    action: string;
    risk: string;
  };
}

@Injectable()
export class ReleaseDeploymentApprovalBridgeService {
  private readonly logger = new Logger(ReleaseDeploymentApprovalBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalRepo: OperationApprovalRepository,
  ) {}

  /** 校验父审批并派生 deployment 审批，返回其 id 供 createRun 使用。失败 fail-closed。 */
  async deriveDeploymentApproval(
    input: DeriveDeploymentApprovalInput,
  ): Promise<string> {
    const parent = await this.loadAndVerifyParent(input);
    const existing = await this.findExistingDerived(input);
    if (existing) {
      this.logger.log(`复用已派生部署审批 ${existing}（父审批 ${input.releaseApprovalId}）`);
      return existing;
    }
    const derived = await this.createDerivedApproval(input, parent);
    this.logger.log(
      `派生部署审批 ${derived}（父审批 ${input.releaseApprovalId}，阶段 ${input.stage.key}）`,
    );
    return derived;
  }

  private async loadAndVerifyParent(
    input: DeriveDeploymentApprovalInput,
  ): Promise<ParentApprovalRow> {
    const parent = await this.approvalRepo.findByIdForTeam(
      input.teamId,
      input.releaseApprovalId,
    );
    assertParentApprovalBridgable(parent as ParentApprovalRow | null, {
      teamId: input.teamId,
      releaseApprovalId: input.releaseApprovalId,
      stage: { id: input.stage.id, key: input.stage.key, configHash: input.stage.configHash },
      plan: { id: input.plan.id, projectId: input.plan.projectId, environmentId: input.plan.environmentId },
    });
    return parent as ParentApprovalRow;
  }

  private async findExistingDerived(
    input: DeriveDeploymentApprovalInput,
  ): Promise<string | null> {
    const candidates = await this.prisma.operationApproval.findMany({
      where: {
        teamId: input.teamId,
        category: "deployment",
        action: input.deploymentContext.action,
        targetType: input.deploymentContext.targetType,
        targetId: input.deploymentContext.projectId,
        projectId: input.deploymentContext.projectId,
        status: "approved",
        consumedAt: null,
      },
      select: { id: true, expiresAt: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const match = candidates.find((c) => {
      const meta = c.metadata as Record<string, unknown> | null;
      return meta?.releaseApprovalId === input.releaseApprovalId;
    });
    if (!match) return null;
    if (match.expiresAt && match.expiresAt.getTime() < Date.now()) return null;
    return match.id;
  }

  private async createDerivedApproval(
    input: DeriveDeploymentApprovalInput,
    parent: ParentApprovalRow,
  ): Promise<string> {
    const ctx = input.deploymentContext;
    const metadata: ApprovalBridgeMetadata = {
      releaseApprovalId: input.releaseApprovalId,
      releaseStageId: input.stage.id,
      releasePlanId: input.plan.id,
      stageKey: input.stage.key,
      stageType: input.stage.type,
      bridgedBy: BRIDGE_REVIEWER_MARKER,
      bridgedAt: new Date().toISOString(),
    };
    const created = await this.prisma.operationApproval.create({
      data: {
        team: { connect: { id: input.teamId } },
        requester: parent.requesterId ? { connect: { id: parent.requesterId } } : undefined,
        project: { connect: { id: ctx.projectId } },
        environment: ctx.environmentId ? { connect: { id: ctx.environmentId } } : undefined,
        application: ctx.applicationId ? { connect: { id: ctx.applicationId } } : undefined,
        applicationService: ctx.applicationServiceId
          ? { connect: { id: ctx.applicationServiceId } }
          : undefined,
        server: ctx.serverId ? { connect: { id: ctx.serverId } } : undefined,
        category: "deployment",
        action: ctx.action,
        targetType: ctx.targetType,
        targetId: ctx.projectId,
        risk: ctx.risk,
        status: "approved",
        reviewedAt: new Date(),
        summary: `${input.plan.name} / ${input.stage.key} 发布阶段审批桥接到部署执行`,
        reason: `由发布阶段审批 ${input.releaseApprovalId}（已人工批准）派生，授权 deployment.run`,
        metadata: metadata as never,
      },
      select: { id: true },
    });
    return created.id;
  }
}
