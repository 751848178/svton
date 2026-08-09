import {
  parityHistoryApprovalData,
  parityHistoryDeploymentData,
  parityHistoryPolicySnapshot,
  parityHistoryVersionData,
} from "./parity-seed-version-history-data.mjs";

export async function seedParityProductionHistoryRecord({
  prisma,
  ids,
  scope,
  record,
  previousVersionId,
}) {
  const release = {
    ...scope,
    releaseOrderId: ids.orderPrev,
    environmentId: ids.envProduction,
    artifactManifestId: record.manifestId,
    configRevisionId: ids.configProduction,
    actorId: ids.user,
    mode: "standard",
    status: "succeeded",
    verifiedDigest: record.digest,
    resourceSnapshot: { version: 2, references: [] },
    routeSnapshot: { version: 2, domains: ["parity.example.test"] },
    policySnapshot: parityHistoryPolicySnapshot(),
    inputHash: record.inputHash,
    idempotencyKey: `parity-prev-production-${record.key.toLowerCase()}`,
    startedAt: record.effectiveAt,
    finishedAt: record.effectiveAt,
  };
  await prisma.releaseRun.upsert({
    where: { id: record.releaseRunId },
    create: { id: record.releaseRunId, ...release },
    update: release,
  });
  const approval = parityHistoryApprovalData(ids, scope, record);
  await prisma.operationApproval.upsert({
    where: { id: record.approvalId },
    create: { id: record.approvalId, ...approval },
    update: approval,
  });
  await prisma.releaseRun.update({
    where: { id: record.releaseRunId },
    data: { operationApprovalId: record.approvalId },
  });
  const deployment = {
    ...parityHistoryDeploymentData(ids, scope, record, "production"),
    operationApprovalId: record.approvalId,
    releaseRunId: record.releaseRunId,
  };
  await prisma.deploymentRun.upsert({
    where: { id: record.productionDeploymentId },
    create: { id: record.productionDeploymentId, ...deployment },
    update: deployment,
  });
  const version = parityHistoryVersionData(ids, scope, record, {
    environmentId: ids.envProduction,
    deploymentRunId: record.productionDeploymentId,
    releaseRunId: record.releaseRunId,
    previousVersionId,
  });
  await prisma.environmentVersion.upsert({
    where: { id: record.productionVersionId },
    create: { id: record.productionVersionId, ...version },
    update: version,
  });
}
