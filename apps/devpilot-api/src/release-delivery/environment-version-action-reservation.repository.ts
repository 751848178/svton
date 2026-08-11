import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { startProductionReleaseExecution } from "./environment-version-production-reservation-boundary";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import { lockAndAssertNoActiveProductionRouteSaga } from "../site/production-route-saga.guard";

export type EnvironmentVersionActionReservationInput = {
  teamId: string;
  projectId: string;
  actorId: string;
  environmentId: string;
  configRevisionId: string | null;
  manifestId: string;
  releaseOrderId: string;
  releaseRunId?: string;
  idempotencyKey?: string;
  inputHash?: string;
  requestHash?: string;
  mode: "deploy" | "rollback";
  branch: string;
  commitSha: string;
  params: Record<string, unknown>;
  providerKey?: string;
  gateDecision?: ReleaseGateDecisionReference;
};

export async function reserveEnvironmentVersionAction(
  tx: Prisma.TransactionClient,
  input: EnvironmentVersionActionReservationInput,
) {
  const resolvedInput = {
    ...input,
    idempotencyKey: input.idempotencyKey ?? randomUUID(),
    inputHash: input.inputHash ?? "legacy-direct-reservation",
    requestHash:
      input.requestHash ?? input.inputHash ?? "legacy-direct-reservation",
  };
  return reserveResolvedEnvironmentVersionAction(tx, resolvedInput);
}

async function reserveResolvedEnvironmentVersionAction(
  tx: Prisma.TransactionClient,
  input: EnvironmentVersionActionReservationInput & {
    idempotencyKey: string;
    inputHash: string;
    requestHash: string;
  },
) {
  await lockActionableReleaseOrder(tx, input);
  const existing = await tx.deploymentRun.findUnique({
    where: {
      projectId_idempotencyKey: {
        projectId: input.projectId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { environmentVersion: true },
  });
  if (existing) return replay(existing, input);
  if (!input.providerKey) {
    throw new ConflictException("环境部署缺少 Deployment Provider");
  }
  await lockAndAssertNoActiveProductionRouteSaga(tx, input);
  if (input.releaseRunId) await claimProduction(tx, input);
  const data = {
    teamId: input.teamId,
    projectId: input.projectId,
    actorId: input.actorId,
    environmentId: input.environmentId,
    artifactManifestId: input.manifestId,
    releaseRunId: input.releaseRunId,
    idempotencyKey: input.idempotencyKey,
    inputHash: input.inputHash,
    requestHash: input.requestHash,
    mode: input.mode,
    source: "release_order",
    trigger: "manual",
    targetType: "release-artifact",
    executorKey: "release-artifact",
    adapterKey: input.providerKey,
    dryRun: false,
    status: "running",
    branch: input.branch,
    commitSha: input.commitSha,
    params: input.params as Prisma.InputJsonValue,
    commandPlan: commandPlan(),
  };
  let run;
  try {
    run = await tx.deploymentRun.create({ data });
  } catch (error) {
    if (!isIdempotencyConflict(error)) throw error;
    const raced = await tx.deploymentRun.findUniqueOrThrow({
      where: {
        projectId_idempotencyKey: {
          projectId: input.projectId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { environmentVersion: true },
    });
    return replay(raced, input);
  }
  if (input.gateDecision) await claimGate(tx, input, run.id);
  return { ...run, idempotentReplay: false as const };
}

function replay<
  T extends {
    teamId: string;
    actorId: string | null;
    environmentId: string | null;
    artifactManifestId: string | null;
    releaseRunId: string | null;
    inputHash: string | null;
    requestHash: string | null;
    mode: string;
    adapterKey: string;
    environmentVersion?: Prisma.EnvironmentVersionGetPayload<object> | null;
  },
>(
  run: T,
  input: EnvironmentVersionActionReservationInput & {
    idempotencyKey: string;
    inputHash: string;
    requestHash: string;
  },
) {
  if (
    run.teamId !== input.teamId ||
    run.actorId !== input.actorId ||
    run.environmentId !== input.environmentId ||
    run.artifactManifestId !== input.manifestId ||
    run.releaseRunId !== (input.releaseRunId ?? null) ||
    run.inputHash !== input.inputHash ||
    run.requestHash !== input.requestHash ||
    run.mode !== input.mode ||
    run.adapterKey !== input.providerKey
  ) {
    throw new ConflictException("幂等键已用于不同的环境版本动作输入");
  }
  return { ...run, idempotentReplay: true as const };
}

async function claimProduction(
  tx: Prisma.TransactionClient,
  input: EnvironmentVersionActionReservationInput,
) {
  if (!input.gateDecision) {
    throw new ConflictException("Production 执行缺少已允许的门禁决定");
  }
  await startProductionReleaseExecution(tx, {
    ...input,
    releaseRunId: input.releaseRunId!,
  });
}

function claimGate(
  tx: Prisma.TransactionClient,
  input: EnvironmentVersionActionReservationInput,
  runId: string,
) {
  return claimReleaseGateDecision(tx, {
    teamId: input.teamId,
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    actorId: input.actorId,
    decisionId: input.gateDecision!.id,
    stage: input.gateDecision!.stage,
    inputHash: input.gateDecision!.inputHash,
    actionRunType: "deployment_run",
    actionRunId: runId,
    requireAllowed: true,
  });
}

function commandPlan() {
  return {
    version: 1,
    steps: ["verify_manifest_digest", "deploy_exact_manifest"],
    checkout: false,
    pull: false,
    build: false,
  };
}

function isIdempotencyConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("idempotencyKey")
  );
}
