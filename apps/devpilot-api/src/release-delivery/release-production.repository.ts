import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { productionPreview } from "./release-production-snapshot.utils";
import type { ReleaseStrategy } from "./release-strategy-capability.types";
import { loadProductionReleaseContext } from "./release-production-context.repository";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import {
  assertNoActiveReleaseRunForEnvironment,
  lockProductionEnvironmentForRelease,
} from "./release-run-concurrency.utils";
import { releaseOperationApprovalSelect } from "./release-operation-approval.select";
import { assertNoActiveProductionRouteSaga } from "../site/production-route-saga.guard";

const releaseRunInclude = {
  operationApproval: {
    select: releaseOperationApprovalSelect,
  },
  artifactManifest: {
    select: { id: true, digest: true, buildRunId: true },
  },
} as const;

@Injectable()
export class ReleaseProductionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
    strategy: ReleaseStrategy = "standard",
  ) {
    return productionPreview(
      await loadProductionReleaseContext(
        this.prisma,
        teamId,
        projectId,
        orderId,
        manifestId,
        strategy,
      ),
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
    strategy?: ReleaseStrategy;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      const preview = productionPreview(
        await loadProductionReleaseContext(
          tx,
          input.teamId,
          input.projectId,
          input.releaseOrderId,
          input.manifestId,
          input.strategy ?? "standard",
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
      await lockProductionEnvironmentForRelease(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: snapshot.environment.id,
      });
      await assertNoActiveProductionRouteSaga(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: snapshot.environment.id,
      });
      await assertNoActiveReleaseRunForEnvironment(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: snapshot.environment.id,
      });
      const run = await tx.releaseRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          environmentId: snapshot.environment.id,
          artifactManifestId: snapshot.manifest.id,
          configRevisionId: snapshot.config.revisionId,
          releasePolicyRevisionId: snapshot.releasePolicy.revisionId,
          actorId: input.actorId,
          status: "awaiting_approval",
          verifiedDigest: snapshot.manifest.digest,
          resourceSnapshot: snapshot.config
            .resourceSnapshot as Prisma.InputJsonValue,
          routeSnapshot: snapshot.config.routeSnapshot as Prisma.InputJsonValue,
          policySnapshot: {
            releasePolicy: snapshot.releasePolicy,
            environmentPolicyReferences: snapshot.config.policySnapshot,
            releaseProtection: releaseProtection(
              snapshot.config.policySnapshot,
              snapshot.releasePolicy.synthetic,
            ),
          } as Prisma.InputJsonValue,
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
}

function releaseProtection(value: unknown, synthetic: boolean) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const candidate = record.releaseProtection;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const protection = candidate as Record<string, unknown>;
    return {
      changeWindowVerified: protection.changeWindowVerified === true,
      freezeVerified: protection.freezeVerified === true,
    };
  }
  return {
    // Standard 发布策略的默认合成策略将变更窗口与冻结期视为已验证；
    // 若存在真实策略行却缺少显式结论则 fail closed（两项均为 false）。
    changeWindowVerified: synthetic === true,
    freezeVerified: synthetic === true,
  };
}
