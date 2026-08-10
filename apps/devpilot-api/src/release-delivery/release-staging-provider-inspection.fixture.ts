import type { PrismaClient } from "@prisma/client";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export function stagingBuildCount(
  prisma: PrismaClient,
  releaseOrderId: string,
) {
  return prisma.buildRun.count({ where: { releaseOrderId } });
}

export function stagingDeploymentCount(prisma: PrismaClient, teamId: string) {
  return prisma.deploymentRun.count({ where: { teamId } });
}

export function stagingDeploymentRows(
  prisma: PrismaClient,
  artifactManifestId: string,
) {
  return prisma.deploymentRun.findMany({
    where: { artifactManifestId },
    select: {
      commandPlan: true,
      status: true,
      adapterKey: true,
      params: true,
      logs: true,
      result: true,
      error: true,
    },
  });
}

export function readStagingReleaseFile(
  scope: string,
  projectId: string,
  environmentId: string,
  runId: string,
  relativePath: string,
) {
  return readFile(
    join(
      scope,
      "deployments",
      projectId,
      environmentId,
      "releases",
      runId,
      relativePath,
    ),
    "utf8",
  );
}

export function readStagingActiveFile(
  scope: string,
  projectId: string,
  environmentId: string,
) {
  return readFile(
    join(scope, "deployments", projectId, environmentId, "active.json"),
    "utf8",
  );
}

export async function cleanupStagingProviderFixture(
  prisma: PrismaClient,
  input: {
    teamId: string;
    userId: string;
    resourceTypeId: string;
    scope: string;
  },
) {
  await prisma.environmentVersion.deleteMany({
    where: { teamId: input.teamId },
  });
  await prisma.team.delete({ where: { id: input.teamId } });
  await prisma.resourceType.delete({ where: { id: input.resourceTypeId } });
  await prisma.user.delete({ where: { id: input.userId } });
  await prisma.$disconnect();
  await rm(input.scope, { recursive: true, force: true });
}
