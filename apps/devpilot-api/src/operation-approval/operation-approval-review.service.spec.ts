import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  OPERATION_APPROVAL_REVIEW_CONFLICT,
  OperationApprovalReviewService,
} from "./operation-approval-review.service";

// F470 单元验收：覆盖 404 / 终态 409 / 策略 403 / pending 胜者 / CAS 输家 409。
// 所有 CAS 与 audit 都经 mock 校验谓词、参数透传、事务共享与唯一性。
describe("OperationApprovalReviewService (F470 unit acceptance)", () => {
  const prisma = { $transaction: jest.fn() };
  const approvalRepository = { findByIdForTeam: jest.fn(), reviewPending: jest.fn() };
  const approvalAuditService = { writeApprovalAudit: jest.fn() };
  const accessPolicyService = { assertCanReviewApproval: jest.fn() };
  const service = new OperationApprovalReviewService(
    prisma as any,
    approvalRepository as any,
    approvalAuditService as any,
    accessPolicyService as any,
  );

  beforeEach(() => jest.clearAllMocks());

  // 验收：缺团队作用域行 → 404；不触碰 policy/CAS/audit。
  it("returns 404 when the team-scoped row is missing and skips policy/CAS/audit", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue(null);

    await expect(
      service.review("team-1", "reviewer-1", "approval-missing", {
        decision: "approved",
      }),
    ).rejects.toThrow(NotFoundException);

    expect(accessPolicyService.assertCanReviewApproval).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(approvalAuditService.writeApprovalAudit).not.toHaveBeenCalled();
  });

  // 验收：初始 approved/rejected/cancelled → 结构化 409；不进入 policy/CAS/audit。
  it("returns structured 409 for an already-terminal approval without policy/CAS/audit", async () => {
    for (const status of ["approved", "rejected", "cancelled"]) {
      approvalRepository.findByIdForTeam.mockResolvedValue({
        id: "approval-1",
        teamId: "team-1",
        status,
      });

      const err = await service
        .review("team-1", "reviewer-1", "approval-1", { decision: "approved" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        code: OPERATION_APPROVAL_REVIEW_CONFLICT,
      });
    }
    expect(accessPolicyService.assertCanReviewApproval).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(approvalAuditService.writeApprovalAudit).not.toHaveBeenCalled();
  });

  // 验收：策略拒绝（403）传播；不进入 CAS/audit。
  it("propagates a policy rejection and skips CAS/audit", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      teamId: "team-1",
      status: "pending",
      projectId: null,
      environmentId: null,
      category: "c",
      action: "a",
      targetType: "t",
      targetId: null,
      risk: "low",
    });
    accessPolicyService.assertCanReviewApproval.mockRejectedValue(
      new ForbiddenException("no review permission"),
    );

    await expect(
      service.review("team-1", "reviewer-1", "approval-1", { decision: "approved" }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(approvalRepository.reviewPending).not.toHaveBeenCalled();
    expect(approvalAuditService.writeApprovalAudit).not.toHaveBeenCalled();
  });

  // 验收：pending 胜者——team/id/reviewer/decision/comment 经事务透传；audit 在同一事务内恰好一次；
  // 返回的对象就是 winner 行（事务内重读）。
  it("writes decision+audit+winner in one transaction and returns the winner row for a pending approval", async () => {
    const approval = {
      id: "approval-1",
      teamId: "team-1",
      status: "pending",
      projectId: null,
      environmentId: null,
      category: "c",
      action: "a",
      targetType: "t",
      targetId: null,
      risk: "low",
    };
    approvalRepository.findByIdForTeam.mockResolvedValue(approval);
    accessPolicyService.assertCanReviewApproval.mockResolvedValue(undefined);

    const winner = {
      ...approval,
      status: "rejected",
      reviewerId: "reviewer-1",
      reviewComment: "blocked",
      reviewedAt: expect.any(Date),
    };
    // 捕获 $transaction 回调，在测试驱动的事务体中执行，验证 CAS/audit 共享同一 tx。
    prisma.$transaction.mockImplementation(async (cb: any) => {
      approvalRepository.reviewPending.mockImplementationOnce(async () => ({
        kind: "won",
        winner,
      }));
      return cb({ __tx: true });
    });

    const result = await service.review("team-1", "reviewer-1", "approval-1", {
      decision: "rejected",
      reviewComment: "blocked",
    });

    // CAS 谓词透传：teamId + approval.id + reviewer + dto + 一个捕获的 reviewedAt。
    expect(approvalRepository.reviewPending).toHaveBeenCalledWith(
      { __tx: true },
      "team-1",
      "approval-1",
      "reviewer-1",
      { decision: "rejected", reviewComment: "blocked" },
      expect.any(Date),
    );
    // audit 在同一事务内恰好一次，action/status 与 decision 匹配。
    expect(approvalAuditService.writeApprovalAudit).toHaveBeenCalledTimes(1);
    expect(approvalAuditService.writeApprovalAudit).toHaveBeenCalledWith(
      winner,
      "approval.rejected",
      "rejected",
      { __tx: true },
    );
    // 返回值就是事务内重读的 winner 行。
    expect(result).toBe(winner);
  });

  // 验收：CAS 输家（count===0）→ 409，不写 audit。
  it("returns structured 409 and writes no audit when CAS loses (count===0)", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      teamId: "team-1",
      status: "pending",
      projectId: null,
      environmentId: null,
      category: "c",
      action: "a",
      targetType: "t",
      targetId: null,
      risk: "low",
    });
    accessPolicyService.assertCanReviewApproval.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (cb: any) => {
      approvalRepository.reviewPending.mockImplementationOnce(async () => ({
        kind: "lost",
      }));
      return cb({ __tx: true });
    });

    const err = await service
      .review("team-1", "reviewer-1", "approval-1", { decision: "approved" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      code: OPERATION_APPROVAL_REVIEW_CONFLICT,
    });
    // 输家不得写 decision audit。
    expect(approvalAuditService.writeApprovalAudit).not.toHaveBeenCalled();
  });

  // 验收：审计抛错 → 事务回滚 → 状态回 pending（$transaction 回调内抛错向上传播）。
  it("rolls back the approval decision when the audit throws inside the transaction", async () => {
    approvalRepository.findByIdForTeam.mockResolvedValue({
      id: "approval-1",
      teamId: "team-1",
      status: "pending",
      projectId: null,
      environmentId: null,
      category: "c",
      action: "a",
      targetType: "t",
      targetId: null,
      risk: "low",
    });
    accessPolicyService.assertCanReviewApproval.mockResolvedValue(undefined);
    approvalRepository.reviewPending.mockResolvedValue({
      kind: "won",
      winner: { id: "approval-1", teamId: "team-1", status: "approved" },
    });
    approvalAuditService.writeApprovalAudit.mockRejectedValue(
      new Error("audit write failed"),
    );
    // 真实 $transaction 语义：回调抛错 → reject（Prisma 自动回滚）。
    prisma.$transaction.mockImplementation(async (cb: any) => cb({ __tx: true }));

    await expect(
      service.review("team-1", "reviewer-1", "approval-1", { decision: "approved" }),
    ).rejects.toThrow("audit write failed");

    // CAS 确实执行了（事务内），但 audit 失败 → 事务回滚，调用方看到错误。
    expect(approvalRepository.reviewPending).toHaveBeenCalled();
  });
});
