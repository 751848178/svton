import {
  buildParityVersionHistoryRecords,
  parityHistoryOrderCreatedAt,
} from "./parity-seed-version-history-records.mjs";
import {
  parityHistoryDeploymentData,
  parityHistoryVersionData,
} from "./parity-seed-version-history-data.mjs";
import { seedParityProductionHistoryRecord } from "./parity-seed-version-history-production.mjs";

export async function seedParityVersionHistory({
  prisma,
  ids,
  pinnedCommit,
  digestA,
  digestB,
  capturedAt,
}) {
  const scope = { teamId: ids.team, projectId: ids.project };
  const records = buildParityVersionHistoryRecords({
    ids,
    pinnedCommit,
    digestA,
    digestB,
    capturedAt,
  });
  const orderCreatedAt = parityHistoryOrderCreatedAt(records);
  await prisma.releaseOrder.upsert({
    where: { id: ids.orderPrev },
    create: {
      id: ids.orderPrev,
      ...scope,
      createdById: ids.user,
      releaseVersion: "0.9.0",
      status: "succeeded",
      createdAt: orderCreatedAt,
    },
    update: { status: "succeeded", createdAt: orderCreatedAt },
  });
  let stagingPreviousVersionId = null;
  let productionPreviousVersionId = null;
  for (const record of records) {
    await seedBuildArtifact(prisma, ids, scope, record);
    await seedStaging(prisma, ids, scope, record, stagingPreviousVersionId);
    await seedParityProductionHistoryRecord({
      prisma,
      ids,
      scope,
      record,
      previousVersionId: productionPreviousVersionId,
    });
    stagingPreviousVersionId = record.stagingVersionId;
    productionPreviousVersionId = record.productionVersionId;
  }
  await Promise.all([
    prisma.projectEnvironment.update({
      where: { id: ids.envStaging },
      data: { currentEnvironmentVersionId: records.at(-1).stagingVersionId },
    }),
    prisma.projectEnvironment.update({
      where: { id: ids.envProduction },
      data: { currentEnvironmentVersionId: records.at(-1).productionVersionId },
    }),
  ]);
  return records;
}

async function seedBuildArtifact(prisma, ids, scope, record) {
  const build = {
    ...scope,
    releaseOrderId: ids.orderPrev,
    triggeredById: ids.user,
    revision: record.revision,
    sourceBranch: "main",
    sourceCommitSha: record.pinnedCommit,
    inputSnapshot: {
      repositoryUrl: "/read-only-repositories/parity-app",
      branch: "main",
    },
    inputHash: record.inputHash,
    status: "succeeded",
    gateSummary: { build: { status: "passed", components: 2 } },
    startedAt: record.effectiveAt,
    finishedAt: record.effectiveAt,
  };
  await prisma.buildRun.upsert({
    where: { id: record.buildId },
    create: { id: record.buildId, ...build },
    update: build,
  });
  const manifest = {
    ...scope,
    releaseOrderId: ids.orderPrev,
    buildRunId: record.buildId,
    digest: record.digest,
    provenance: { fixture: true, sourceCommitSha: record.pinnedCommit },
  };
  await prisma.artifactManifest.upsert({
    where: { id: record.manifestId },
    create: { id: record.manifestId, ...manifest },
    update: manifest,
  });
  await prisma.artifactManifestItem.upsert({
    where: {
      manifestId_componentKey: {
        manifestId: record.manifestId,
        componentKey: "project-bundle",
      },
    },
    create: {
      id: record.manifestItemId,
      manifestId: record.manifestId,
      componentKey: "project-bundle",
      artifactType: "static_bundle",
      uri: `file:///var/lib/devpilot/release-build/artifacts/${record.buildId}/bundle.tar.gz`,
      digest: record.digest,
      metadata: { fixture: true },
    },
    update: { digest: record.digest },
  });
}

async function seedStaging(prisma, ids, scope, record, previousVersionId) {
  const deployment = parityHistoryDeploymentData(ids, scope, record, "staging");
  await prisma.deploymentRun.upsert({
    where: { id: record.stagingDeploymentId },
    create: { id: record.stagingDeploymentId, ...deployment },
    update: deployment,
  });
  const version = parityHistoryVersionData(ids, scope, record, {
    environmentId: ids.envStaging,
    deploymentRunId: record.stagingDeploymentId,
    previousVersionId,
  });
  await prisma.environmentVersion.upsert({
    where: { id: record.stagingVersionId },
    create: { id: record.stagingVersionId, ...version },
    update: version,
  });
}
