import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type {
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
  input: Scope & { stage: ReleaseGateDecisionStage; inputHash?: string },
): Promise<ReleaseGateDecision> {
  const inputHash = input.inputHash || randomUUID();
  const phase = {
    build: "commit",
    staging: "build",
    production: "deploy",
  }[input.stage] as "commit" | "build" | "deploy";
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
      (input: Scope & { stage: ReleaseGateDecisionStage }) =>
        persistAllowedTestDecision(prisma, {
          ...input,
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
