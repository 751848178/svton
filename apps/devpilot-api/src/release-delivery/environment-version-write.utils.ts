import { Prisma } from "@prisma/client";

export class DeploymentRunTerminalConflictError extends Error {
  constructor(readonly actualStatus: string) {
    super(`DEPLOYMENT_RUN_ALREADY_${actualStatus.toUpperCase()}`);
  }
}

export async function completeVersionedDeployment(
  tx: Prisma.TransactionClient,
  input: {
    deploymentRunId: string;
    status: "completed" | "failed" | "blocked";
    kind: "deploy" | "upgrade" | "recovery";
    logs: string[];
    result?: Record<string, unknown>;
    error?: string;
  },
  onTransition?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const finishedAt = new Date();
  const transitioned = await tx.deploymentRun.updateMany({
    where: { id: input.deploymentRunId, status: "running" },
    data: {
      status: input.status,
      logs: input.logs,
      result: input.result as Prisma.InputJsonValue | undefined,
      error: input.error,
      finishedAt,
    },
  });
  if (transitioned.count === 0) {
    const current = await tx.deploymentRun.findUniqueOrThrow({
      where: { id: input.deploymentRunId },
      select: { status: true },
    });
    if (current.status !== input.status) {
      throw new DeploymentRunTerminalConflictError(current.status);
    }
    if (input.status !== "completed") {
      return { version: null, transitioned: false };
    }
    const version = await tx.environmentVersion.findUniqueOrThrow({
      where: { deploymentRunId: input.deploymentRunId },
    });
    return { version, transitioned: false };
  }
  const run = await tx.deploymentRun.findUniqueOrThrow({
    where: { id: input.deploymentRunId },
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
  if (input.status !== "completed") {
    await onTransition?.(tx);
    if (run.releaseRunId) {
      await tx.releaseRun.updateMany({
        where: { id: run.releaseRunId, status: "running" },
        data: {
          status: "failed",
          errorCode:
            input.status === "blocked"
              ? "SITE_ROUTE_COMPENSATION_REQUIRED"
              : "ENVIRONMENT_DEPLOYMENT_FAILED",
          errorMessage: input.error,
          finishedAt,
        },
      });
    }
    return { version: null, transitioned: true };
  }
  if (!run.environmentId || !run.artifactManifestId || !run.artifactManifest) {
    throw new Error("VERSIONED_DEPLOYMENT_SCOPE_MISSING");
  }
  await tx.$queryRaw`SELECT id FROM ProjectEnvironment WHERE id = ${run.environmentId} FOR UPDATE`;
  const environment = await tx.projectEnvironment.findUniqueOrThrow({
    where: { id: run.environmentId },
    select: { currentEnvironmentVersionId: true, identityLockedAt: true },
  });
  await onTransition?.(tx);
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
  return { version, transitioned: true };
}
