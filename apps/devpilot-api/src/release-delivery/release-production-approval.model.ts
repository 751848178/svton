import { Prisma } from "@prisma/client";
import { productionApprovalRequired } from "./release-gate-checkpoint.policy";

interface ApprovalInput {
  teamId: string;
  actorId: string;
  projectId: string;
}

interface ApprovalSnapshot {
  environment: { id: string };
  releaseOrder: { releaseVersion: string };
  build: { revision: number };
}

export function productionApprovalData(
  input: ApprovalInput,
  snapshot: ApprovalSnapshot,
  releaseRunId: string,
  inputHash: string,
): Prisma.OperationApprovalUncheckedCreateInput {
  const required = productionApprovalRequired();
  return {
    teamId: input.teamId,
    requesterId: input.actorId,
    projectId: input.projectId,
    environmentId: snapshot.environment.id,
    category: "release",
    action: "project.release_order.deploy_production",
    targetType: "release_run",
    targetId: releaseRunId,
    risk: "high",
    status: required ? "pending" : "approved",
    reviewerId: required ? undefined : input.actorId,
    reviewedAt: required ? undefined : new Date(),
    reviewComment: required
      ? undefined
      : "basic_v1 direct production deployment",
    inputHash,
    summary:
      `生产发布 ${snapshot.releaseOrder.releaseVersion} / Build #${snapshot.build.revision}`,
    metadata: {
      snapshot,
      immutable: true,
      autoApprovedByReleaseFlow: required ? null : "basic_v1",
    } as unknown as Prisma.InputJsonValue,
  };
}
