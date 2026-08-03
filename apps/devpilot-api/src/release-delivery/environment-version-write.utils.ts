import { Prisma } from "@prisma/client";

export async function completeVersionedDeployment(
  tx: Prisma.TransactionClient,
  input: {
    deploymentRunId: string;
    status: "completed" | "failed";
    kind: "deploy" | "upgrade" | "recovery";
    logs: string[];
    result?: Record<string, unknown>;
    error?: string;
  },
) {
  const finishedAt = new Date();
  const run = await tx.deploymentRun.update({
    where: { id: input.deploymentRunId },
    data: {
      status: input.status,
      logs: input.logs,
      result: input.result as Prisma.InputJsonValue | undefined,
      error: input.error,
      finishedAt,
    },
    select: {
      id: true,
      teamId: true,
      projectId: true,
      environmentId: true,
      artifactManifestId: true,
      releaseRunId: true,
      artifactManifest: { select: { releaseOrderId: true } },
    },
  });
  if (input.status === "failed") {
    if (run.releaseRunId) {
      await tx.releaseRun.updateMany({
        where: { id: run.releaseRunId, status: "running" },
        data: {
          status: "failed",
          errorCode: "ENVIRONMENT_DEPLOYMENT_FAILED",
          errorMessage: input.error,
          finishedAt,
        },
      });
    }
    return null;
  }
  if (!run.environmentId || !run.artifactManifestId || !run.artifactManifest) {
    throw new Error("VERSIONED_DEPLOYMENT_SCOPE_MISSING");
  }
  await tx.$queryRaw`SELECT id FROM ProjectEnvironment WHERE id = ${run.environmentId} FOR UPDATE`;
  const environment = await tx.projectEnvironment.findUniqueOrThrow({
    where: { id: run.environmentId },
    select: { currentEnvironmentVersionId: true, identityLockedAt: true },
  });
  const version = await tx.environmentVersion.upsert({
    where: { deploymentRunId: run.id },
    create: {
      teamId: run.teamId,
      projectId: run.projectId,
      environmentId: run.environmentId,
      releaseOrderId: run.artifactManifest.releaseOrderId,
      artifactManifestId: run.artifactManifestId,
      deploymentRunId: run.id,
      releaseRunId: run.releaseRunId,
      previousVersionId: environment.currentEnvironmentVersionId,
      kind: input.kind,
      effectiveAt: finishedAt,
    },
    update: {},
  });
  await tx.projectEnvironment.update({
    where: { id: run.environmentId },
    data: {
      currentEnvironmentVersionId: version.id,
      identityLockedAt: environment.identityLockedAt ?? finishedAt,
    },
  });
  if (run.releaseRunId) {
    const releaseRun = await tx.releaseRun.update({
      where: { id: run.releaseRunId },
      data: { status: "succeeded", finishedAt },
      select: { operationApprovalId: true },
    });
    if (releaseRun.operationApprovalId) {
      await tx.operationApproval.updateMany({
        where: {
          id: releaseRun.operationApprovalId,
          status: "approved",
          consumedAt: null,
        },
        data: { consumedAt: finishedAt },
      });
    }
  }
  return version;
}
