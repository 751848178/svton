import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

type ProductionReservation = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  configRevisionId: string | null;
  manifestId: string;
  releaseRunId: string;
};

export async function startProductionReleaseExecution(
  tx: Prisma.TransactionClient,
  input: ProductionReservation,
) {
  await tx.$queryRaw`SELECT id FROM ProjectEnvironment WHERE id = ${input.environmentId} FOR UPDATE`;
  const environment = await tx.projectEnvironment.findFirst({
    where: {
      id: input.environmentId,
      teamId: input.teamId,
      projectId: input.projectId,
      status: "active",
      baselineRole: "production",
      currentConfigRevisionId: input.configRevisionId,
    },
    select: { id: true },
  });
  if (!environment) {
    throw new ConflictException(
      "Production 环境或配置修订已漂移，请重新检查门禁",
    );
  }
  await tx.$queryRaw`SELECT id FROM ReleaseRun WHERE id = ${input.releaseRunId} FOR UPDATE`;
  const releaseRun = await tx.releaseRun.findFirst({
    where: exactReleaseRun(input),
    select: { id: true, inputHash: true, operationApprovalId: true },
  });
  if (!releaseRun?.operationApprovalId) {
    throw new ConflictException("Production ReleaseRun 缺少可消费的批准记录");
  }
  await tx.$queryRaw`SELECT id FROM OperationApproval WHERE id = ${releaseRun.operationApprovalId} FOR UPDATE`;
  const approval = await tx.operationApproval.findFirst({
    where: {
      id: releaseRun.operationApprovalId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      status: "approved",
      consumedAt: null,
      inputHash: releaseRun.inputHash,
    },
    select: { id: true, expiresAt: true },
  });
  if (
    !approval ||
    (approval.expiresAt && approval.expiresAt.getTime() < Date.now())
  ) {
    throw new ConflictException("Production 审批已失效、过期或输入漂移");
  }
  const claimed = await tx.releaseRun.updateMany({
    where: exactReleaseRun(input),
    data: { status: "running", startedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new ConflictException("Production ReleaseRun 已被执行或状态已变化");
  }
}

function exactReleaseRun(input: ProductionReservation) {
  return {
    id: input.releaseRunId,
    teamId: input.teamId,
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    environmentId: input.environmentId,
    artifactManifestId: input.manifestId,
    configRevisionId: input.configRevisionId,
    status: "awaiting_approval",
  };
}
