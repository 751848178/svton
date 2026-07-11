import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import {
  ListOperationApprovalsQueryDto,
  ReviewOperationApprovalDto,
} from "./dto/operation-approval.dto";
import { OperationApprovalAuditService } from "./operation-approval-audit.service";
import { OperationApprovalMatchService } from "./operation-approval-match.service";
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

  async review(
    teamId: string,
    reviewerId: string,
    approvalId: string,
    dto: ReviewOperationApprovalDto,
  ) {
    const approval = await this.approvalRepository.findByIdForTeam(
      teamId,
      approvalId,
    );

    if (!approval) {
      throw new NotFoundException("操作审批不存在");
    }

    if (approval.status !== "pending") {
      throw new BadRequestException("只有待审批的操作可以审批");
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

    const reviewed = await this.approvalRepository.review(
      approval.id,
      reviewerId,
      dto,
    );

    await this.approvalAuditService.writeApprovalAudit(
      reviewed,
      dto.decision === "approved" ? "approval.approved" : "approval.rejected",
      dto.decision,
    );
    return reviewed;
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
