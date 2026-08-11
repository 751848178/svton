import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import type {
  ReleaseGateCheckpoint,
  ReleaseGateDecision,
  ReleaseGateDecisionStage,
} from "./release-gate-decision.types";

type Scope = {
  teamId: string;
  actorId: string;
  projectId: string;
  releaseOrderId: string;
};

export async function persistAllowedTestDecision(
  prisma: PrismaClient,
  input: Scope & {
    stage: ReleaseGateDecisionStage;
    checkpoint?: ReleaseGateCheckpoint;
    inputHash?: string;
  },
): Promise<ReleaseGateDecision> {
  const inputHash = input.inputHash || randomUUID();
  const phase = input.checkpoint
    ? releaseGateCheckpointPolicy(input.checkpoint).phase
    : ({
    build: "commit",
    staging: "build",
    production: "deploy",
  }[input.stage] as "commit" | "build" | "deploy");
  const row = await prisma.releaseGateDecision.create({
    data: {
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      stage: input.stage,
      phase,
      allowed: true,
      definitionVersion: "test",
      inputHash,
      inputSnapshot: {},
      blockerGateIds: [],
      manualGateIds: [],
      confirmedManualGateIds: [],
      warningGateIds: [],
      deferredGateIds: [],
      evidenceOnlyGateIds: [],
      integrityErrors: [],
    },
  });
  return {
    id: row.id,
    stage: input.stage,
    checkpoint: input.checkpoint ?? (
      input.stage === "build"
        ? "build_pre_execution"
        : input.stage === "staging"
          ? "staging_pre_execution"
          : "production_pre_execution"),
    phase,
    allowed: true,
    blockerGateIds: [],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    inputHash,
    decidedAt: row.createdAt.toISOString(),
  };
}

export function gatePolicyTestDouble(prisma: PrismaClient) {
  return {
    assertAllowed: jest.fn(
      (input: Scope & { checkpoint: ReleaseGateCheckpoint }) =>
        persistAllowedTestDecision(prisma, {
          ...input,
          stage: releaseGateCheckpointPolicy(input.checkpoint).stage,
          inputHash: stableHash(input),
        }),
    ),
  };
}

export function productionGateTestDouble(prisma: PrismaClient) {
  const decide = (context: Scope & { releaseRunId?: string }) =>
    context.releaseRunId
      ? persistAllowedTestDecision(prisma, { ...context, stage: "production" })
      : undefined;
  return {
    admit: jest.fn(decide),
    finalize: jest.fn(decide),
    denied: jest.fn().mockResolvedValue(undefined),
  };
}
