import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseStrategy } from "./release-strategy-capability.types";

type Client = Prisma.TransactionClient | PrismaService;

export async function loadProductionReleaseContext(
  client: Client,
  teamId: string,
  projectId: string,
  releaseOrderId: string,
  manifestId: string,
  strategy: ReleaseStrategy,
) {
  const order = await client.releaseOrder.findFirst({
    where: { id: releaseOrderId, teamId, projectId },
    select: {
      id: true,
      projectId: true,
      releaseVersion: true,
      project: {
        select: {
          currentReleasePolicyRevision: {
            select: {
              id: true,
              revision: true,
              strategy: true,
              requireProductionApproval: true,
              snapshotHash: true,
            },
          },
        },
      },
    },
  });
  const productionEnvironments = await client.projectEnvironment.findMany({
    where: {
      teamId,
      projectId,
      status: "active",
      baselineRole: "production",
    },
    select: {
      id: true,
      key: true,
      name: true,
      currentConfigRevision: {
        select: {
          id: true,
          revision: true,
          snapshotHash: true,
          resourceReferences: true,
          routeSnapshot: true,
          policyReferences: true,
        },
      },
    },
  });
  const manifest = await client.artifactManifest.findFirst({
    where: { id: manifestId, teamId, projectId, releaseOrderId },
    include: {
      buildRun: {
        select: {
          id: true,
          revision: true,
          status: true,
          sourceBranch: true,
          sourceCommitSha: true,
        },
      },
      items: true,
    },
  });
  const stagingProof = await client.deploymentRun.findFirst({
    where: {
      teamId,
      projectId,
      artifactManifestId: manifestId,
      source: "release_order",
      status: "completed",
      projectEnvironment: { baselineRole: "staging" },
    },
    select: { id: true, environmentId: true, result: true, finishedAt: true },
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
  });
  return {
    order,
    productionEnvironments,
    manifest,
    stagingProof,
    strategy,
    releasePolicy: order?.project.currentReleasePolicyRevision ?? null,
  };
}

