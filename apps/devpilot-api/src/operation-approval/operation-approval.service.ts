import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { ControlAccessPolicyService } from '../control-access-policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListOperationApprovalsQueryDto,
  ReviewOperationApprovalDto,
} from './dto/operation-approval.dto';
import { buildOperationApprovalWhere } from './operation-approval-list-query.utils';

export type CreateOperationApprovalInput = {
  teamId: string;
  requesterId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: string;
  summary?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | Prisma.InputJsonValue | null;
  reusePending?: boolean;
};

export type ValidateOperationApprovalInput = CreateOperationApprovalInput & {
  approvalId?: string | null;
};

@Injectable()
export class OperationApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventService: AuditEventService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  async list(teamId: string, query: ListOperationApprovalsQueryDto) {
    return this.prisma.operationApproval.findMany({
      where: buildOperationApprovalWhere(teamId, query),
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: this.approvalInclude(),
    });
  }

  async createPending(input: CreateOperationApprovalInput) {
    if (input.requesterId) {
      await this.accessPolicyService.assertCanRequestApproval({
        teamId: input.teamId,
        actorId: input.requesterId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        category: input.category,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        risk: input.risk,
      });
    }

    const existing = input.reusePending === false
      ? null
      : await this.prisma.operationApproval.findFirst({
          where: {
            teamId: input.teamId,
            requesterId: input.requesterId ?? null,
            category: input.category,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId ?? null,
            status: 'pending',
          },
          include: this.approvalInclude(),
        });

    if (existing) {
      return existing;
    }

    const approval = await this.prisma.operationApproval.create({
      data: this.toCreateData(input),
      include: this.approvalInclude(),
    });

    await this.writeApprovalAudit(approval, 'approval.requested', 'pending');
    return approval;
  }

  async review(
    teamId: string,
    reviewerId: string,
    approvalId: string,
    dto: ReviewOperationApprovalDto,
  ) {
    const approval = await this.prisma.operationApproval.findFirst({
      where: { id: approvalId, teamId },
      include: this.approvalInclude(),
    });

    if (!approval) {
      throw new NotFoundException('操作审批不存在');
    }

    if (approval.status !== 'pending') {
      throw new BadRequestException('只有待审批的操作可以审批');
    }

    await this.accessPolicyService.assertCanReviewApproval({
      teamId,
      actorId: reviewerId,
      projectId: approval.projectId,
      environmentId: approval.environmentId,
      category: approval.category,
      action: approval.action,
      targetType: approval.targetType,
      targetId: approval.targetId,
      risk: approval.risk,
    });

    const reviewed = await this.prisma.operationApproval.update({
      where: { id: approval.id },
      data: {
        status: dto.decision,
        reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      },
      include: this.approvalInclude(),
    });

    await this.writeApprovalAudit(
      reviewed,
      dto.decision === 'approved' ? 'approval.approved' : 'approval.rejected',
      dto.decision,
    );
    return reviewed;
  }

  async resolveApproved(input: ValidateOperationApprovalInput) {
    if (!input.approvalId) {
      return null;
    }

    const approval = await this.prisma.operationApproval.findFirst({
      where: { id: input.approvalId, teamId: input.teamId },
      include: this.approvalInclude(),
    });

    if (!approval) {
      throw new BadRequestException('审批单不存在或不属于当前团队');
    }

    if (approval.status !== 'approved') {
      throw new BadRequestException('审批单尚未批准');
    }

    if (approval.consumedAt) {
      throw new BadRequestException('审批单已被使用');
    }

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      throw new BadRequestException('审批单已过期');
    }

    if (
      approval.requesterId &&
      input.requesterId &&
      approval.requesterId !== input.requesterId &&
      approval.reviewerId !== input.requesterId
    ) {
      throw new BadRequestException('审批单申请人/审批人与当前执行人不一致');
    }

    this.assertApprovalMatches(approval, input);
    if (input.requesterId) {
      await this.accessPolicyService.assertCanExecuteApproved({
        teamId: input.teamId,
        actorId: input.requesterId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        category: input.category,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        risk: input.risk,
      });
    }
    return approval;
  }

  async consume(teamId: string, approvalId?: string | null) {
    if (!approvalId) return null;

    return this.prisma.operationApproval.updateMany({
      where: {
        id: approvalId,
        teamId,
        status: 'approved',
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }

  private approvalInclude(): Prisma.OperationApprovalInclude {
    return {
      requester: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      application: { select: { id: true, name: true, status: true } },
      applicationService: { select: { id: true, name: true, kind: true, runtime: true } },
      server: { select: { id: true, name: true, host: true } },
      site: { select: { id: true, name: true, primaryDomain: true } },
      managedResource: {
        select: { id: true, name: true, sourceType: true, provider: true, kind: true, endpoint: true },
      },
      resourceActionRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          action: true,
          status: true,
          dryRun: true,
          startedAt: true,
          serverExecutionJob: {
            select: {
              id: true,
              status: true,
              queueMode: true,
              attempt: true,
              maxAttempts: true,
              queuedAt: true,
              startedAt: true,
              finishedAt: true,
            },
          },
        },
      },
      applicationServiceOperationRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          action: true,
          status: true,
          dryRun: true,
          startedAt: true,
          serverExecutionJob: {
            select: {
              id: true,
              status: true,
              queueMode: true,
              attempt: true,
              maxAttempts: true,
              queuedAt: true,
              startedAt: true,
              finishedAt: true,
            },
          },
        },
      },
      siteSyncRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: { id: true, mode: true, status: true, dryRun: true, startedAt: true, targetConfigPath: true },
      },
      deploymentRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          mode: true,
          status: true,
          dryRun: true,
          startedAt: true,
          branch: true,
          commitSha: true,
        },
      },
    };
  }

  private toCreateData(input: CreateOperationApprovalInput): Prisma.OperationApprovalCreateInput {
    return {
      team: { connect: { id: input.teamId } },
      requester: input.requesterId ? { connect: { id: input.requesterId } } : undefined,
      project: input.projectId ? { connect: { id: input.projectId } } : undefined,
      environment: input.environmentId ? { connect: { id: input.environmentId } } : undefined,
      application: input.applicationId ? { connect: { id: input.applicationId } } : undefined,
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
      metadata: input.metadata !== undefined && input.metadata !== null
        ? this.toJsonValue(input.metadata)
        : undefined,
    };
  }

  private assertApprovalMatches(
    approval: {
      category: string;
      action: string;
      targetType: string;
      targetId: string | null;
      projectId: string | null;
      environmentId: string | null;
      applicationId: string | null;
      applicationServiceId: string | null;
      serverId: string | null;
      siteId: string | null;
      managedResourceId: string | null;
    },
    input: ValidateOperationApprovalInput,
  ) {
    const checks: Array<[string, string | null | undefined, string | null | undefined]> = [
      ['category', approval.category, input.category],
      ['action', approval.action, input.action],
      ['targetType', approval.targetType, input.targetType],
      ['targetId', approval.targetId, input.targetId ?? null],
      ['projectId', approval.projectId, input.projectId ?? null],
      ['environmentId', approval.environmentId, input.environmentId ?? null],
      ['applicationId', approval.applicationId, input.applicationId ?? null],
      ['applicationServiceId', approval.applicationServiceId, input.applicationServiceId ?? null],
      ['serverId', approval.serverId, input.serverId ?? null],
      ['siteId', approval.siteId, input.siteId ?? null],
      ['managedResourceId', approval.managedResourceId, input.managedResourceId ?? null],
    ];

    const mismatched = checks.find(([, actual, expected]) => actual !== expected);
    if (mismatched) {
      throw new BadRequestException(`审批单与本次操作不匹配: ${mismatched[0]}`);
    }
  }

  private async writeApprovalAudit(
    approval: {
      id: string;
      teamId: string;
      requesterId: string | null;
      reviewerId: string | null;
      projectId: string | null;
      environmentId: string | null;
      applicationId: string | null;
      applicationServiceId: string | null;
      serverId: string | null;
      siteId: string | null;
      managedResourceId: string | null;
      category: string;
      action: string;
      targetType: string;
      targetId: string | null;
      risk: string;
      status: string;
      summary: string | null;
      reviewComment: string | null;
    },
    action: string,
    status: string,
  ) {
    await this.auditEventService.create({
      teamId: approval.teamId,
      actorId: approval.reviewerId || approval.requesterId,
      projectId: approval.projectId,
      environmentId: approval.environmentId,
      applicationId: approval.applicationId,
      applicationServiceId: approval.applicationServiceId,
      serverId: approval.serverId,
      siteId: approval.siteId,
      managedResourceId: approval.managedResourceId,
      operationApprovalId: approval.id,
      category: 'operation_approval',
      action,
      targetType: 'operation_approval',
      targetId: approval.id,
      risk: approval.risk,
      status,
      summary: approval.summary,
      metadata: {
        requestedCategory: approval.category,
        requestedAction: approval.action,
        requestedTargetType: approval.targetType,
        requestedTargetId: approval.targetId,
        reviewComment: approval.reviewComment,
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
