import { UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assertIndependentCodeApproval } from "./gate-evaluation-independent-approval.repository";
import { assertIndependentProductionApproval } from "./gate-manual-production-independence.repository";

type ApprovalEvaluation = {
  id: string;
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string | null;
  releaseRunId: string | null;
  gateId: string;
  inputHash: string;
  summary: unknown;
  expiresAt: Date | null;
};

export async function persistGateManualApproval(
  prisma: Prisma.TransactionClient,
  row: ApprovalEvaluation,
  input: { actorId: string; reason: string },
) {
  const action = record(record(row.summary).decisionIdentity);
  const approvalSubjectHash = string(action.approvalSubjectHash);
  const actionInputHash = string(action.actionInputHash);
  const requesterActorId = string(action.requesterActorId);
  if (!approvalSubjectHash || !actionInputHash || !requesterActorId) {
    throw new UnprocessableEntityException(
      "人工门禁缺少服务端冻结的动作哈希或请求人身份",
    );
  }
  if (requesterActorId === input.actorId) {
    throw new UnprocessableEntityException("动作请求人不能确认自己的人工门禁");
  }
  const source = row.gateId === "C03"
    ? await assertIndependentCodeApproval(prisma, row, input.actorId)
    : null;
  if (row.gateId === "P03") {
    await assertIndependentProductionApproval(prisma, row, input.actorId);
  }
  try {
    return await prisma.gateManualApproval.create({
      data: {
      teamId: row.teamId,
      projectId: row.projectId,
      releaseOrderId: row.releaseOrderId,
      gateEvaluationId: row.id,
      evaluationInputHash: row.inputHash,
      approvalSubjectHash,
      actionInputHash,
      requesterActorId,
      reviewerActorId: input.actorId,
      sourcePolicyRevisionId: source?.sourcePolicyRevisionId,
      sourcePolicySnapshotHash: source?.sourcePolicySnapshotHash,
      sourceCommitSha: source?.sourceCommitSha,
      reason: input.reason,
      confirmedAt: new Date(),
      expiresAt: row.expiresAt,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    return prisma.gateManualApproval.findFirstOrThrow({
      where: {
        gateEvaluationId: row.id,
        evaluationInputHash: row.inputHash,
        approvalSubjectHash,
        reviewerActorId: input.actorId,
      },
    });
  }
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" &&
    "code" in error && error.code === "P2002");
}

function string(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
