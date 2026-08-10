import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseProductionRepository } from "./release-production.repository";

export interface ProductionFixture {
  prisma: PrismaClient;
  repository: ReleaseProductionRepository;
  suffix: string;
  userId: string;
  teamId: string;
  projectId: string;
  orderId: string;
  manifestId: string;
  productionEnvironmentId: string;
  stagingEnvironmentId: string;
  itemId: string;
}

export async function createProductionFixture(): Promise<ProductionFixture> {
  const prisma = new PrismaClient();
  const repository = new ReleaseProductionRepository(
    prisma as unknown as PrismaService,
  );
  const suffix = randomUUID();
  const userId = `production-user-${suffix}`;
  const teamId = `production-team-${suffix}`;
  const projectId = `production-project-${suffix}`;
  await prisma.user.create({
    data: { id: userId, email: `${suffix}@production.example`, role: "user" },
  });
  await prisma.team.create({ data: { id: teamId, name: "Production Team" } });
  await prisma.project.create({
    data: {
      id: projectId,
      teamId,
      createdById: userId,
      name: "Production Project",
      config: {},
    },
  });
  const staging = await prisma.projectEnvironment.create({
    data: {
      teamId,
      projectId,
      key: "staging",
      name: "Staging",
      baselineRole: "staging",
    },
  });
  const production = await prisma.projectEnvironment.create({
    data: {
      teamId,
      projectId,
      key: "production",
      name: "Production",
      baselineRole: "production",
    },
  });
  const revision = await prisma.environmentConfigRevision.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      revision: 1,
      snapshotHash: "config-v1",
      resourceReferences: [],
      routeSnapshot: {},
      policyReferences: [],
    },
  });
  await prisma.projectEnvironment.update({
    where: { id: production.id },
    data: { currentConfigRevisionId: revision.id },
  });
  const order = await prisma.releaseOrder.create({
    data: { teamId, projectId, createdById: userId, releaseVersion: "1.0.0" },
  });
  const build = await prisma.buildRun.create({
    data: {
      teamId,
      projectId,
      releaseOrderId: order.id,
      triggeredById: userId,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      inputSnapshot: {},
      inputHash: "build-hash",
      status: "succeeded",
    },
  });
  const manifest = await prisma.artifactManifest.create({
    data: {
      teamId,
      projectId,
      releaseOrderId: order.id,
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
    include: { items: true },
  });
  await prisma.deploymentRun.create({
    data: {
      teamId,
      projectId,
      actorId: userId,
      environmentId: staging.id,
      artifactManifestId: manifest.id,
      source: "release_order",
      targetType: "release-artifact",
      status: "completed",
      dryRun: false,
      finishedAt: new Date(),
      result: {
        artifactVerified: true,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
      },
    },
  });
  return {
    prisma,
    repository,
    suffix,
    userId,
    teamId,
    projectId,
    orderId: order.id,
    manifestId: manifest.id,
    productionEnvironmentId: production.id,
    stagingEnvironmentId: staging.id,
    itemId: manifest.items[0].id,
  };
}

export async function cleanupProductionFixture(fixture: ProductionFixture) {
  await fixture.prisma.environmentVersion.deleteMany({
    where: { teamId: fixture.teamId },
  });
  await fixture.prisma.releaseRun.deleteMany({
    where: { teamId: fixture.teamId },
  });
  await fixture.prisma.team.delete({ where: { id: fixture.teamId } });
  await fixture.prisma.user.delete({ where: { id: fixture.userId } });
  await fixture.prisma.$disconnect();
}
