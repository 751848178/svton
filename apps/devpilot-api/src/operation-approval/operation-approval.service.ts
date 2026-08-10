import { BadRequestException, Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import {
  ListOperationApprovalsQueryDto,
  ReviewOperationApprovalDto,
} from "./dto/operation-approval.dto";
import { OperationApprovalAuditService } from "./operation-approval-audit.service";
import { OperationApprovalMatchService } from "./operation-approval-match.service";
import { OperationApprovalReviewService } from "./operation-approval-review.service";
import { OperationApprovalRequirementService } from "./operation-approval-requirement.service";
import { OperationApprovalRepository } from "./operation-approval.repository";
import {
  CreateOperationApprovalInput,
  OperationApprovalRequirement,
  ValidateOperationApprovalInput,
} from "./operation-approval.types";

@Injectable()
export class OperationApprovalService {
  constructor(
    private readonly approvalRepository: OperationApprovalRepository,
    private readonly approvalMatchService: OperationApprovalMatchService,
    private readonly approvalAuditService: OperationApprovalAuditService,
    private readonly approvalRequirementService: OperationApprovalRequirementService,
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly reviewService: OperationApprovalReviewService,
  ) {}

  async list(teamId: string, query: ListOperationApprovalsQueryDto) {
    return this.approvalRepository.list(teamId, query);
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

    const existing =
      input.reusePending === false
        ? null
        : await this.approvalRepository.findReusablePending(input);

    if (existing) {
      return existing;
    }

    const approvalRequirement =
      await this.approvalRequirementService.evaluate(input);
    const approval = await this.approvalRepository.create({
      ...input,
      metadata: this.withApprovalRequirement(input, approvalRequirement),
    });

    await this.approvalAuditService.writeApprovalAudit(
      approval,
      "approval.requested",
      "pending",
    );
    return approval;
  }

  // F470：并发审批已移至 OperationApprovalReviewService（CAS + 交互式事务 + 唯一 audit）。
  // 本方法保留为薄 facade，参数契约不变（控制器仍调用 approvalService.review）。
  async review(
    teamId: string,
    reviewerId: string,
    approvalId: string,
    dto: ReviewOperationApprovalDto,
  ) {
    return this.reviewService.review(teamId, reviewerId, approvalId, dto);
  }

  async resolveApproved(input: ValidateOperationApprovalInput) {
    if (!input.approvalId) {
      return null;
    }

    const approval = await this.approvalRepository.findByIdForTeam(
      input.teamId,
      input.approvalId,
    );

    if (!approval) {
      throw new BadRequestException("审批单不存在或不属于当前团队");
    }

    if (approval.status !== "approved") {
      throw new BadRequestException("审批单尚未批准");
    }

    if (approval.consumedAt) {
      throw new BadRequestException("审批单已被使用");
    }

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      throw new BadRequestException("审批单已过期");
    }

    if (
      approval.requesterId &&
      input.requesterId &&
      approval.requesterId !== input.requesterId &&
      approval.reviewerId !== input.requesterId
    ) {
      throw new BadRequestException("审批单申请人/审批人与当前执行人不一致");
    }

    this.approvalMatchService.assertMatches(approval, input);
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

    return this.approvalRepository.consume(teamId, approvalId);
  }

  private withApprovalRequirement(
    input: CreateOperationApprovalInput,
    approvalRequirement: OperationApprovalRequirement,
  ) {
    const metadata = input.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return { value: metadata ?? null, approvalRequirement };
    }
    return { ...(metadata as Record<string, unknown>), approvalRequirement };
  }
}
