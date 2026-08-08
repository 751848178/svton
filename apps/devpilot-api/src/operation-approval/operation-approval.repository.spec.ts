import { OperationApprovalRepository } from "./operation-approval.repository";

// F470 单元验收：reviewPending 的 CAS 谓词精确性 + count===0/1 分支行为。
// 验证谓词同时包含 id、teamId、status:pending；零行不读 winner；一行读 winner。
describe("OperationApprovalRepository.reviewPending (F470 CAS predicate)", () => {
  const updateMany = jest.fn();
  const findUnique = jest.fn();
  const tx = { operationApproval: { updateMany, findUnique } };
  const prisma = {} as any;
  const repo = new OperationApprovalRepository(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("predicates the CAS on exact id + teamId + status:pending and writes decision+reviewer+comment+reviewedAt", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: "approval-1", status: "approved" });

    const reviewedAt = new Date();
    const outcome = await repo.reviewPending(
      tx as any,
      "team-1",
      "approval-1",
      "reviewer-1",
      { decision: "approved", reviewComment: "ok" },
      reviewedAt,
    );

    // 谓词精确性：id + teamId + status:pending 三者缺一不可（防 last-writer-wins）。
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "approval-1", teamId: "team-1", status: "pending" },
      data: {
        status: "approved",
        reviewerId: "reviewer-1",
        reviewComment: "ok",
        reviewedAt,
      },
    });
    expect(outcome).toEqual({
      kind: "won",
      winner: { id: "approval-1", status: "approved" },
    });
    // count===1 时事务内重读 winner。
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "approval-1" },
      include: expect.any(Object),
    });
  });

  it("returns lost and does not read a winner when CAS affects zero rows", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const outcome = await repo.reviewPending(
      tx as any,
      "team-1",
      "approval-1",
      "reviewer-1",
      { decision: "rejected", reviewComment: "no" },
      new Date(),
    );

    expect(outcome).toEqual({ kind: "lost" });
    // count===0 不得读 winner（避免基于陈旧行构造响应）。
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects the DTO with rejected decision through the same CAS path", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: "approval-1", status: "rejected" });

    const outcome = await repo.reviewPending(
      tx as any,
      "team-1",
      "approval-1",
      "reviewer-9",
      { decision: "rejected", reviewComment: "blocked" },
      new Date(),
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          reviewerId: "reviewer-9",
          reviewComment: "blocked",
        }),
      }),
    );
    expect(outcome.kind).toBe("won");
  });
});
