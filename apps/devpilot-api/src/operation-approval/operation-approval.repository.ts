import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ListOperationApprovalsQueryDto,
  ReviewOperationApprovalDto,
} from "./dto/operation-approval.dto";
import { OPERATION_APPROVAL_INCLUDE } from "./operation-approval-includes.constants";
import { buildOperationApprovalWhere } from "./operation-approval-list-query.utils";
import { CreateOperationApprovalInput } from "./operation-approval.types";

// CAS 输赢类型：reviewPending 返回 winner 行（count===1）或 null（count===0 并发输家）。
export type ReviewPendingOutcome =
  | { kind: "won"; winner: Awaited<ReturnType<Prisma.TransactionClient["operationApproval"]["findUnique"]>> }
  | { kind: "lost" };

@Injectable()
export class OperationApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, query: ListOperationApprovalsQueryDto) {
    return this.prisma.operationApproval.findMany({
      where: buildOperationApprovalWhere(teamId, query),
      orderBy: { requestedAt: "desc" },
      take: 100,
      include: OPERATION_APPROVAL_INCLUDE,
    });
  }

  findReusablePending(input: CreateOperationApprovalInput) {
    return this.prisma.operationApproval.findFirst({
      where: {
        teamId: input.teamId,
        requesterId: input.requesterId ?? null,
        category: input.category,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        inputHash: input.inputHash ?? null,
        status: "pending",
      },
      include: OPERATION_APPROVAL_INCLUDE,
    });
  }

  // 最新绑定到某个 target（如 release_stage）的审批；用于阶段绑定审批的生命周期判定
  findLatestForTarget(teamId: string, targetType: string, targetId: string) {
    return this.prisma.operationApproval.findFirst({
      where: { teamId, targetType, targetId },
      orderBy: { createdAt: "desc" },
      include: OPERATION_APPROVAL_INCLUDE,
    });
  }

  // 把指定审批标记为 cancelled（用于 re-request 流程作废已拒绝的旧审批）
  async cancel(approvalId: string, currentStatus: string): Promise<number> {
    const r = await this.prisma.operationApproval.updateMany({
      where: { id: approvalId, status: currentStatus },
      data: { status: "cancelled" },
    });
    return r.count;
  }

  create(input: CreateOperationApprovalInput) {
    return this.prisma.operationApproval.create({
      data: this.toCreateData(input),
      include: OPERATION_APPROVAL_INCLUDE,
    });
  }

  findByIdForTeam(teamId: string, approvalId: string) {
    return this.prisma.operationApproval.findFirst({
      where: { id: approvalId, teamId },
      include: OPERATION_APPROVAL_INCLUDE,
    });
  }

  // F470：唯一并发决策点。updateMany CAS 谓词同时锁定 id + teamId + status:pending。
  // 必须运行在调用方提供的交互式事务 tx 内，使 CAS 写与 decision audit 共享同一事务边界。
  // count===1 为胜者：事务内重读 winner（同一 include 形状）作为返回值。
  // count===0 为并发输家：不读 winner、不写 audit，返回 { kind: 'lost' } 由调用方报 409。
  async reviewPending(
    tx: Prisma.TransactionClient,
    teamId: string,
    approvalId: string,
    reviewerId: string,
    dto: ReviewOperationApprovalDto,
    reviewedAt: Date,
  ): Promise<ReviewPendingOutcome> {
    const cas = await tx.operationApproval.updateMany({
      where: { id: approvalId, teamId, status: "pending" },
      data: {
        status: dto.decision,
        reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt,
      },
    });
    if (cas.count === 0) return { kind: "lost" };
    const winner = await tx.operationApproval.findUnique({
      where: { id: approvalId },
      include: OPERATION_APPROVAL_INCLUDE,
    });
    return { kind: "won", winner };
  }

  consume(teamId: string, approvalId: string) {
    return this.prisma.operationApproval.updateMany({
      where: {
        id: approvalId,
        teamId,
        status: "approved",
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }

  private toCreateData(
    input: CreateOperationApprovalInput,
  ): Prisma.OperationApprovalCreateInput {
    return {
      team: { connect: { id: input.teamId } },
      requester: input.requesterId
        ? { connect: { id: input.requesterId } }
        : undefined,
      project: input.projectId
        ? { connect: { id: input.projectId } }
        : undefined,
      environment: input.environmentId
        ? { connect: { id: input.environmentId } }
        : undefined,
      application: input.applicationId
        ? { connect: { id: input.applicationId } }
        : undefined,
      applicationService: input.applicationServiceId
        ? { connect: { id: input.applicationServiceId } }
        : undefined,
      server: input.serverId ? { connect: { id: input.serverId } } : undefined,
      site: input.siteId ? { connect: { id: input.siteId } } : undefined,
      managedResource: input.managedResourceId
        ? { connect: { id: input.managedResourceId } }
        : undefined,
      category: input.category,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? undefined,
      risk: input.risk,
      inputHash: input.inputHash ?? null,
      summary: input.summary ?? undefined,
      reason: input.reason ?? undefined,
      metadata:
        input.metadata !== undefined && input.metadata !== null
          ? this.toJsonValue(input.metadata)
          : undefined,
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
