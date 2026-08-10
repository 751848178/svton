import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";

export async function seedReleaseOrderEvidence(
  fixture: ReleaseBuildHttpRuntimeFixture,
) {
  const prisma = fixture.git.prisma;
  const scope = {
    teamId: fixture.git.teamId,
    projectId: fixture.git.projectId,
  };
  const staging = await prisma.projectEnvironment.create({
    data: {
      ...scope,
      key: "staging",
      name: "Staging",
      baselineRole: "staging",
    },
  });
  const production = await prisma.projectEnvironment.create({
    data: {
      ...scope,
      key: "production",
      name: "Production",
      baselineRole: "production",
    },
  });
  const build = await prisma.buildRun.create({
    data: {
      ...scope,
      releaseOrderId: fixture.git.orderId,
      triggeredById: fixture.git.userId,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      inputSnapshot: {},
      inputHash: "f429-build",
      status: "succeeded",
    },
  });
  const manifest = await prisma.artifactManifest.create({
    data: {
      ...scope,
      releaseOrderId: fixture.git.orderId,
      buildRunId: build.id,
      digest: `sha256:${"b".repeat(64)}`,
      items: {
        create: [
          {
            componentKey: "project-bundle",
            artifactType: "zip",
            uri: `release-artifact://${build.id}/bundle.zip`,
            digest: `sha256:${"b".repeat(64)}`,
          },
        ],
      },
    },
  });
  const stagingRuns = await Promise.all(
    [1, 2].map(() =>
      prisma.deploymentRun.create({
        data: {
          ...scope,
          environmentId: staging.id,
          artifactManifestId: manifest.id,
          source: "release_order",
          targetType: "release-artifact",
          dryRun: false,
          status: "completed",
          finishedAt: new Date(),
          result: {
            artifactVerified: true,
            manifestId: manifest.id,
            manifestDigest: manifest.digest,
          },
        },
      }),
    ),
  );
  const stagingProof = stagingRuns[0];
  if (!stagingProof?.finishedAt) {
    throw new Error("Staging proof fixture missing");
  }
  const release = await prisma.releaseRun.create({
    data: {
      ...scope,
      releaseOrderId: fixture.git.orderId,
      environmentId: production.id,
      artifactManifestId: manifest.id,
      actorId: fixture.git.userId,
      status: "succeeded",
      verifiedDigest: manifest.digest,
      inputHash: "f429-production",
      idempotencyKey: "f429-runtime",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const approval = await prisma.operationApproval.create({
    data: {
      ...scope,
      requesterId: fixture.git.userId,
      environmentId: production.id,
      category: "release",
      action: "project.release_order.deploy_production",
      targetType: "release_run",
      targetId: release.id,
      risk: "high",
      status: "approved",
      inputHash: release.inputHash,
      reviewedAt: new Date(),
      metadata: {
        snapshot: {
          version: 2,
          projectId: scope.projectId,
          releaseOrder: { id: fixture.git.orderId },
          environment: { id: production.id },
          build: { id: build.id },
          manifest: { id: manifest.id, digest: manifest.digest },
          stagingProof: {
            deploymentRunId: stagingProof.id,
            environmentId: staging.id,
            finishedAt: stagingProof.finishedAt.toISOString(),
          },
        },
      },
    },
  });
  await prisma.releaseRun.update({
    where: { id: release.id },
    data: { operationApprovalId: approval.id },
  });
  await prisma.deploymentRun.create({
    data: {
      ...scope,
      environmentId: production.id,
      artifactManifestId: manifest.id,
      releaseRunId: release.id,
      source: "release_order",
      targetType: "release-artifact",
      dryRun: false,
      status: "completed",
      finishedAt: new Date(),
      logs: ["production exact Manifest started", "health passed"],
      result: {
        workloadReady: { status: "passed" },
        healthProbe: { status: "passed" },
        httpProbe: { status: "passed" },
      },
    },
  });
  return stagingProof.id;
}
