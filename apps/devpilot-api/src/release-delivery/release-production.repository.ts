import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { productionPreview } from "./release-production-snapshot.utils";

const releaseRunInclude = {
  operationApproval: {
    select: { id: true, status: true, inputHash: true, requestedAt: true },
  },
  artifactManifest: {
    select: { id: true, digest: true, buildRunId: true },
  },
} as const;

type Client = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ReleaseProductionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
  ) {
    return productionPreview(
      await this.context(this.prisma, teamId, projectId, orderId, manifestId),
    );
  }

  list(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseRun.findMany({
      where: {
        teamId,
        projectId,
        releaseOrderId,
        environment: { baselineRole: "production" },
      },
      include: releaseRunInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  confirm(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    manifestId: string;
    actorId: string;
    expectedInputHash: string;
    idempotencyKey: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ReleaseOrder WHERE id = ${input.releaseOrderId} FOR UPDATE`;
      const preview = productionPreview(
        await this.context(
          tx,
          input.teamId,
          input.projectId,
          input.releaseOrderId,
          input.manifestId,
        ),
      );
      if (preview.inputHash !== input.expectedInputHash) {
        throw new ConflictException(
          "Production 配置或策略已变化，请重新确认最新快照",
        );
      }
      const existing = await tx.releaseRun.findUnique({
        where: {
          releaseOrderId_idempotencyKey: {
            releaseOrderId: input.releaseOrderId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: releaseRunInclude,
      });
      if (existing) {
        if (
          existing.inputHash !== preview.inputHash ||
          existing.artifactManifestId !== input.manifestId
        ) {
          throw new ConflictException("幂等键已绑定不同的生产发布输入");
        }
        return existing;
      }
      const snapshot = preview.snapshot;
      const run = await tx.releaseRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          environmentId: snapshot.environment.id,
          artifactManifestId: snapshot.manifest.id,
          configRevisionId: snapshot.config.revisionId,
          actorId: input.actorId,
          status: "awaiting_approval",
          verifiedDigest: snapshot.manifest.digest,
          resourceSnapshot: snapshot.config
            .resourceSnapshot as Prisma.InputJsonValue,
          routeSnapshot: snapshot.config.routeSnapshot as Prisma.InputJsonValue,
          policySnapshot: snapshot.config
            .policySnapshot as Prisma.InputJsonValue,
          inputHash: preview.inputHash,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const approval = await tx.operationApproval.create({
        data: {
          teamId: input.teamId,
          requesterId: input.actorId,
          projectId: input.projectId,
          environmentId: snapshot.environment.id,
          category: "release",
          action: "project.release_order.deploy_production",
          targetType: "release_run",
          targetId: run.id,
          risk: "high",
          status: "pending",
          inputHash: preview.inputHash,
          summary: `生产发布 ${snapshot.releaseOrder.releaseVersion} / Build #${snapshot.build.revision}`,
          metadata: {
            snapshot,
            immutable: true,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return tx.releaseRun.update({
        where: { id: run.id },
        data: { operationApprovalId: approval.id },
        include: releaseRunInclude,
      });
    });
  }

  private async context(
    client: Client,
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    manifestId: string,
  ) {
    const order = await client.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: { id: true, projectId: true, releaseVersion: true },
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
    return { order, productionEnvironments, manifest, stagingProof };
  }
}
