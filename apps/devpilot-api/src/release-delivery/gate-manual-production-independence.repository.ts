import { UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export async function assertIndependentProductionApproval(
  prisma: Prisma.TransactionClient,
  row: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    releaseRunId: string | null;
    summary: unknown;
  },
  actorId: string,
) {
  if (!row.releaseRunId) {
    throw new UnprocessableEntityException(
      "Production 人工门禁缺少精确 ReleaseRun",
    );
  }
  const summary = record(row.summary);
  const evidence = record(summary.evidenceIdentity);
  const action = record(summary.decisionIdentity);
  if (
    evidence.releaseRunId !== row.releaseRunId ||
    evidence.deploymentRunId !== action.deploymentRunId ||
    evidence.candidateHash !== action.candidateHash
  ) {
    throw new UnprocessableEntityException(
      "Production 人工门禁证据与动作候选不一致",
    );
  }
  const release = await prisma.releaseRun.findFirst({
    where: {
      id: row.releaseRunId,
      teamId: row.teamId,
      projectId: row.projectId,
      releaseOrderId: row.releaseOrderId,
    },
    select: {
      actorId: true,
      operationApproval: {
        select: {
          requesterId: true,
          teamId: true,
          projectId: true,
          environmentId: true,
        },
      },
      environmentId: true,
      status: true,
      deploymentRuns: {
        where: { id: string(evidence.deploymentRunId) ?? "" },
        select: { id: true, status: true, result: true },
        take: 1,
      },
    },
  });
  const approval = release?.operationApproval;
  if (!release || !approval || approval.teamId !== row.teamId ||
    approval.projectId !== row.projectId ||
    approval.environmentId !== release.environmentId) {
    throw new UnprocessableEntityException(
      "Production ReleaseRun 或审批作用域不一致",
    );
  }
  const deployment = release.deploymentRuns[0];
  const candidate = record(record(deployment?.result).productionCandidate);
  if (release.status !== "awaiting_validation" ||
    deployment?.status !== "awaiting_validation" ||
    candidate.candidateHash !== evidence.candidateHash) {
    throw new UnprocessableEntityException(
      "Production 候选已变化或不再等待人工验证",
    );
  }
  const actionRequester = string(action.requesterActorId);
  if (!actionRequester || [
    actionRequester,
    release.actorId,
    approval.requesterId,
  ].filter(Boolean).includes(actorId)) {
    throw new UnprocessableEntityException(
      "Production 人工门禁必须由非动作请求人、非发布请求人的独立人员确认",
    );
  }
}

function string(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
