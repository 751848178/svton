import { UnprocessableEntityException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { independentApprovalBlocker } from "./release-gate-independent-approval.policy";

export async function assertIndependentCodeApproval(
  prisma: PrismaService,
  row: { actorId: string | null; buildRunId: string | null; summary: unknown },
  actorId: string,
) {
  const identity = record(record(row.summary).evidenceIdentity);
  const authorId = identity.commitAuthorUserId;
  const policyId = identity.sourcePolicyRevisionId;
  const commit = identity.sourceCommitSha;
  if (
    typeof authorId !== "string" ||
    typeof policyId !== "string" ||
    typeof commit !== "string" ||
    !commit
  ) {
    throw new UnprocessableEntityException(
      "C03 缺少可证明的策略、Commit 或作者身份，不能人工确认",
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
    requesterActorId: row.actorId,
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
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
