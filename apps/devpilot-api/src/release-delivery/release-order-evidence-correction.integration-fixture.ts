import type { ProductionFixture } from "./release-production.integration-fixture";

export async function seedCorrectedProductionEvidence(
  fixture: ProductionFixture,
) {
  const preview = await fixture.repository.preview(
    fixture.teamId,
    fixture.projectId,
    fixture.orderId,
    fixture.manifestId,
  );
  const release = await fixture.repository.confirm({
    teamId: fixture.teamId,
    projectId: fixture.projectId,
    releaseOrderId: fixture.orderId,
    manifestId: fixture.manifestId,
    actorId: fixture.userId,
    expectedInputHash: preview.inputHash,
    idempotencyKey: `evidence-${fixture.suffix}`,
  });
  await fixture.prisma.deploymentRun.create({
    data: stagingRun(fixture),
  });
  const approvalId = release.operationApproval?.id;
  if (!approvalId) throw new Error("Production fixture approval missing");
  await fixture.prisma.operationApproval.update({
    where: { id: approvalId },
    data: { status: "approved", reviewedAt: new Date() },
  });
  await fixture.prisma.releaseRun.update({
    where: { id: release.id },
    data: {
      status: "succeeded",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const exact = await fixture.prisma.deploymentRun.create({
    data: productionRun(fixture, release.id),
  });
  const repeated = await fixture.prisma.deploymentRun.create({
    data: productionRun(fixture, release.id),
  });
  await fixture.prisma.deploymentRun.create({
    data: {
      ...productionRun(fixture, release.id),
      actorId: undefined,
      artifactManifestId: undefined,
      finishedAt: undefined,
    },
  });
  await fixture.prisma.releaseRun.create({
    data: {
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      releaseOrderId: fixture.orderId,
      environmentId: fixture.productionEnvironmentId,
      artifactManifestId: fixture.manifestId,
      actorId: fixture.userId,
      status: "succeeded",
      verifiedDigest: `sha256:${"b".repeat(64)}`,
      inputHash: "invalid-unapproved",
      idempotencyKey: `invalid-${fixture.suffix}`,
    },
  });
  return {
    releaseId: release.id,
    proofId: preview.snapshot.stagingProof.deploymentRunId,
    deploymentIds: [exact.id, repeated.id],
  };
}

function stagingRun(fixture: ProductionFixture) {
  return {
    teamId: fixture.teamId,
    projectId: fixture.projectId,
    actorId: fixture.userId,
    environmentId: fixture.stagingEnvironmentId,
    artifactManifestId: fixture.manifestId,
    source: "release_order",
    targetType: "release-artifact",
    status: "completed",
    dryRun: false,
    finishedAt: new Date(),
    result: {
      artifactVerified: true,
      manifestId: fixture.manifestId,
      manifestDigest: `sha256:${"b".repeat(64)}`,
    },
  } as const;
}

function productionRun(fixture: ProductionFixture, releaseRunId: string) {
  return {
    teamId: fixture.teamId,
    projectId: fixture.projectId,
    actorId: fixture.userId,
    environmentId: fixture.productionEnvironmentId,
    artifactManifestId: fixture.manifestId,
    releaseRunId,
    source: "release_order",
    targetType: "release-artifact",
    status: "completed",
    dryRun: false,
    finishedAt: new Date(),
  } as const;
}
