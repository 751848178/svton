/**
 * F470 — OperationApproval 并发审批修复。
 *
 * 旧 OperationApprovalService.review 用 findByIdForTeam 读 pending（仅 stale fast-path 观察，
 * 非并发守卫），授权通过后 operationApproval.update({ where: { id } }) 无条件覆盖整行。
 * 两个 reviewer 并发：都读 pending → 都过授权 → 都写 → 互相覆盖 reviewer/comment/status，
 * 各写一条矛盾的 decision audit（last-writer-wins）。
 *
 * 修复：提取本单一职责服务，pending→终态只能成功一次，唯一并发决策点是 Prisma CAS。
 *
 * 流程（required invariants）：
 *   1. 事务外：团队作用域读 + 终态 fast-path 冲突预检 + 访问策略检查。
 *   2. 交互式事务内：repository.reviewPending 执行 updateMany CAS（where id+teamId+pending）。
 *      - count===1 胜者：事务内重读 winner 行（返回值），同事务写唯一 decision audit。
 *      - count===0 输家：不读 winner、不写 audit，抛结构化 409 OPERATION_APPROVAL_REVIEW_CONFLICT。
 *   3. 审计抛错 → 事务回滚 → 审批状态回到 pending，无 decision audit。
 *
 * 不变 keep：404/403/DTO/控制器契约、消费语义（仅 approved 可消费，消费一次，已消费不可再审批）。
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewOperationApprovalDto } from "./dto/operation-approval.dto";
import { OperationApprovalAuditService } from "./operation-approval-audit.service";
import { OperationApprovalRepository } from "./operation-approval.repository";

// 结构化 409 错误码：并发审批冲突（CAS 输家 / 已被并发推进终态）。
export const OPERATION_APPROVAL_REVIEW_CONFLICT = "OPERATION_APPROVAL_REVIEW_CONFLICT";

@Injectable()
export class OperationApprovalReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalRepository: OperationApprovalRepository,
    private readonly approvalAuditService: OperationApprovalAuditService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  async review(
    teamId: string,
    reviewerId: string,
    approvalId: string,
    dto: ReviewOperationApprovalDto,
  ) {
    // 1. 事务外：团队作用域读。404 不动 policy/CAS/audit。
    const approval = await this.approvalRepository.findByIdForTeam(
      teamId,
      approvalId,
    );
    if (!approval) {
      throw new NotFoundException("操作审批不存在");
    }

    // 2. 终态 fast-path 冲突预检：已 approved/rejected/cancelled 直接报 409，不动 policy/CAS/audit。
    if (approval.status !== "pending") {
      throw this.reviewConflict();
    }

    // 3. 事务外访问策略检查：403 传播，不进入 CAS/audit。
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

    // 4. 单一交互式事务：CAS 决策 + 唯一 decision audit。reviewedAt 在事务外捕获一次，
    //    随 status/reviewer/comment 一起写，保证胜者的返回值、DB 行、audit 三者一致。
    const reviewedAt = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const result = await this.approvalRepository.reviewPending(
        tx,
        teamId,
        approval.id,
        reviewerId,
        dto,
        reviewedAt,
      );
      if (result.kind === "lost") return result; // 输家：不写 audit。
      if (!result.winner) return result; // count===1 但重读落空（理论不可达）→ 不写 audit。
      // 胜者：同一事务写唯一 decision audit。audit 抛错 → 事务回滚 → 状态回 pending。
      await this.approvalAuditService.writeApprovalAudit(
        result.winner,
        dto.decision === "approved" ? "approval.approved" : "approval.rejected",
        dto.decision,
        tx,
      );
      return result;
    });

    if (outcome.kind === "lost") {
      // 输家：未读 winner、未写 audit。结构化 409。
      throw this.reviewConflict();
    }
    return outcome.winner;
  }

  private reviewConflict(): ConflictException {
    return new ConflictException({
      code: OPERATION_APPROVAL_REVIEW_CONFLICT,
      message: "操作审批已被并发处理，请刷新后重试",
    });
  }
}
