import { UnprocessableEntityException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { independentApprovalBlocker } from "./release-gate-independent-approval.policy";

export async function assertIndependentCodeApproval(
  prisma: PrismaService,
  row: {
    projectId: string;
    buildRunId: string | null;
    summary: unknown;
  },
  actorId: string,
) {
  const summary = record(row.summary);
  const evidence = record(summary.evidenceIdentity);
  const action = record(summary.decisionIdentity);
  const authorId = evidence.commitAuthorUserId;
  const policyId = evidence.sourcePolicyRevisionId;
  const policyHash = evidence.sourcePolicySnapshotHash;
  const commit = evidence.sourceCommitSha;
  const requesterActorId = action.requesterActorId;
  const actionInputHash = action.actionInputHash;
  if (
    typeof authorId !== "string" ||
    typeof policyId !== "string" ||
    typeof policyHash !== "string" ||
    typeof commit !== "string" ||
    !commit ||
    typeof requesterActorId !== "string" ||
    typeof actionInputHash !== "string" ||
    !actionInputHash
  ) {
    throw new UnprocessableEntityException(
      "C03 缺少可证明的策略、Commit 或作者身份，不能人工确认",
    );
  }
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { currentSourcePolicyRevisionId: true },
  });
  const policy = await prisma.sourcePolicyRevision.findFirst({
    where: { id: policyId, projectId: row.projectId, snapshotHash: policyHash },
    select: { id: true },
  });
  if (!policy || project?.currentSourcePolicyRevisionId !== policy.id) {
    throw new UnprocessableEntityException(
      "C03 SourcePolicyRevision 已变化，必须重新检查",
    );
  }
  let buildActorId: string | null = null;
  if (row.buildRunId) {
    const build = await prisma.buildRun.findUnique({
      where: { id: row.buildRunId },
      select: { triggeredById: true },
    });
    if (!build) throw new UnprocessableEntityException("C03 BuildRun 不存在");
    buildActorId = build.triggeredById;
  }
  const blocker = independentApprovalBlocker({
    requesterActorId,
    buildActorId,
    commitAuthorUserId: authorId,
    confirmerActorId: actorId,
  });
  if (blocker) {
    throw new UnprocessableEntityException({
      code: blocker,
      message: "C03 必须由非请求人、非执行人且非 Commit 作者的独立人员确认",
    });
  }
  return {
    actionInputHash,
    requesterActorId,
    sourcePolicyRevisionId: policyId,
    sourcePolicySnapshotHash: policyHash,
    sourceCommitSha: commit,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
