import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertNoActiveProductionRouteSaga, routeSagaScope,
} from "../site/production-route-saga.guard";
import { loadProductionReleaseContext } from "./release-production-context.repository";
import { productionPreview } from "./release-production-snapshot.utils";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import {
  isUniqueConflict,
  recoveryProtection,
  recoveryRunInclude,
  resolveRecoverySource,
  type RecoveryScope,
} from "./environment-version-recovery.utils";
import {
  assertNoActiveReleaseRunForEnvironment,
  lockProductionEnvironmentForRelease,
} from "./release-run-concurrency.utils";

@Injectable()
export class EnvironmentVersionRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async preview(input: RecoveryScope) {
    const source = await resolveRecoverySource(this.prisma, input);
    const preview = productionPreview(
      await loadProductionReleaseContext(
        this.prisma,
        input.teamId,
        input.projectId,
        source.releaseOrderId,
        source.artifactManifestId,
        "standard",
      ),
    );
    return {
      ...preview,
      sourceVersionId: source.id,
      sourceReleaseRunId: source.releaseRunId,
      sourceVersionKind: source.kind,
    };
  }

  async confirm(
    input: RecoveryScope & {
      actorId: string;
      expectedInputHash: string;
      idempotencyKey: string;
    },
  ) {
    const scopeSource = await resolveRecoverySource(this.prisma, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const source = await resolveRecoverySource(tx, input);
        await lockActionableReleaseOrder(tx, {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: source.releaseOrderId,
        });
        const preview = productionPreview(
          await loadProductionReleaseContext(
            tx,
            input.teamId,
            input.projectId,
            source.releaseOrderId,
            source.artifactManifestId,
            "standard",
          ),
        );
        if (preview.inputHash !== input.expectedInputHash) {
          throw new ConflictException(
            "生产配置或策略已漂移，请重新确认最新恢复快照",
          );
        }
        const existing = await tx.releaseRun.findUnique({
          where: {
            releaseOrderId_idempotencyKey: {
              releaseOrderId: source.releaseOrderId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: recoveryRunInclude,
        });
        if (existing) {
          if (
            existing.inputHash !== preview.inputHash ||
            existing.artifactManifestId !== source.artifactManifestId ||
            existing.mode !== "recovery"
          ) {
            throw new ConflictException("幂等键已绑定不同的生产恢复输入");
          }
          return existing;
        }
        await assertRecoveryReservationAvailable(tx, {
          teamId: input.teamId,
          projectId: input.projectId,
          environmentId: input.environmentId,
        });
        const snapshot = preview.snapshot;
        const run = await tx.releaseRun.create({
          data: {
            teamId: input.teamId,
            projectId: input.projectId,
            releaseOrderId: source.releaseOrderId,
            environmentId: snapshot.environment.id,
            artifactManifestId: snapshot.manifest.id,
            configRevisionId: snapshot.config.revisionId,
            releasePolicyRevisionId: snapshot.releasePolicy.revisionId,
            sourceReleaseRunId: source.releaseRunId,
            mode: "recovery",
            actorId: input.actorId,
            status: "awaiting_approval",
            verifiedDigest: snapshot.manifest.digest,
            resourceSnapshot: snapshot.config
              .resourceSnapshot as Prisma.InputJsonValue,
            routeSnapshot: snapshot.config
              .routeSnapshot as Prisma.InputJsonValue,
            policySnapshot: {
              releasePolicy: snapshot.releasePolicy,
              environmentPolicyReferences: snapshot.config.policySnapshot,
              releaseProtection: recoveryProtection(
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
            action: "project.release_order.deploy_production_recovery",
            targetType: "release_run",
            targetId: run.id,
            risk: "high",
            status: "pending",
            inputHash: preview.inputHash,
            summary: `生产回退 ${snapshot.releaseOrder.releaseVersion} / Build #${snapshot.build.revision}`,
            metadata: {
              snapshot,
              sourceVersionId: source.id,
              sourceReleaseRunId: source.releaseRunId,
              immutable: true,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return tx.releaseRun.update({
          where: { id: run.id },
          data: { operationApprovalId: approval.id },
          include: recoveryRunInclude,
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.releaseRun.findUnique({
          where: {
            releaseOrderId_idempotencyKey: {
              releaseOrderId: scopeSource.releaseOrderId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: recoveryRunInclude,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }
}

export async function assertRecoveryReservationAvailable(
  tx: Prisma.TransactionClient,
  scope: { teamId: string; projectId: string; environmentId: string },
) {
  await lockProductionEnvironmentForRelease(tx, scope);
  await assertNoActiveProductionRouteSaga(tx, routeSagaScope(scope));
  await assertNoActiveReleaseRunForEnvironment(tx, scope);
}
