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
        status: "pending",
      },
      include: OPERATION_APPROVAL_INCLUDE,
    });
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

  review(
    approvalId: string,
    reviewerId: string,
    dto: ReviewOperationApprovalDto,
  ) {
    return this.prisma.operationApproval.update({
      where: { id: approvalId },
      data: {
        status: dto.decision,
        reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      },
      include: OPERATION_APPROVAL_INCLUDE,
    });
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
