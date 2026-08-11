import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canonicalJson } from "../release-orchestration/utils/release-hash.utils";
import { GATE_DEFINITION_VERSION } from "./gate-evaluation-persistence.utils";
import { releaseGateActionIdentity } from "./release-gate-action-identity.policy";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import type {
  ReleaseGateCheckpoint,
  ReleaseGateDecisionReference,
} from "./release-gate-decision.types";

export async function assertGateDecisionCurrent(
  tx: Prisma.TransactionClient,
  input: {
    teamId: string; projectId: string; releaseOrderId: string; actorId: string;
    checkpoint: ReleaseGateCheckpoint;
    reference: ReleaseGateDecisionReference;
    assertActionInput?: (value: Record<string, string | null>) => void;
  },
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id FROM ReleaseGateDecision WHERE id = ${input.reference.id} FOR UPDATE
  `);
  const policy = releaseGateCheckpointPolicy(input.checkpoint);
  const decision = await tx.releaseGateDecision.findFirst({
    where: {
      id: input.reference.id, teamId: input.teamId,
      projectId: input.projectId, releaseOrderId: input.releaseOrderId,
      actorId: input.actorId, stage: policy.stage, allowed: true,
      consumedAt: null, inputHash: input.reference.inputHash,
      definitionVersion: GATE_DEFINITION_VERSION,
    },
  });
  const snapshot = decisionSnapshot(decision?.inputSnapshot);
  if (!decision || !snapshot || snapshot.checkpoint !== input.checkpoint) {
    throw conflict(`${input.checkpoint} 门禁决定已失效或漂移`);
  }
  const expectedAction = releaseGateActionIdentity({
    checkpoint: input.checkpoint,
    requesterActorId: input.actorId,
    actionInput: snapshot.actionInput,
  });
  if (snapshot.requesterActorId !== input.actorId ||
    snapshot.actionInputHash !== expectedAction.actionInputHash ||
    input.reference.actionInputHash !== expectedAction.actionInputHash) {
    throw conflict(`${input.checkpoint} 动作身份已漂移`);
  }
  input.assertActionInput?.(snapshot.actionInput);
  assertRequiredSet(snapshot, input.checkpoint);
  const rows = await tx.gateEvaluation.findMany({
    where: { id: { in: snapshot.evaluations.map((item) => item.evaluationId) } },
    include: { manualApprovals: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const project = snapshot.evaluations.some((item) => item.gateId === "C03")
    ? await tx.project.findUniqueOrThrow({ where: { id: input.projectId },
        select: { currentSourcePolicyRevisionId: true } })
    : null;
  for (const frozen of snapshot.evaluations) {
    const row = byId.get(frozen.evaluationId);
    if (!row || row.gateId !== frozen.gateId ||
      row.inputHash !== frozen.evaluationInputHash ||
      row.definitionVersion !== GATE_DEFINITION_VERSION || !row.providerKey ||
      (row.expiresAt && row.expiresAt.getTime() < Date.now())) {
      throw conflict(`${frozen.gateId} 门禁证据已失效或漂移`);
    }
    if (row.status === "needs_human") {
      await assertManualCount(tx, row, snapshot,
        project?.currentSourcePolicyRevisionId ?? null);
    } else if (row.status !== "passed" && row.status !== "warning") {
      throw conflict(`${row.gateId} 门禁不再允许当前动作`);
    }
  }
  return snapshot;
}

function assertRequiredSet(snapshot: DecisionSnapshot, checkpoint: ReleaseGateCheckpoint) {
  const expected = releaseGateCheckpointPolicy(checkpoint).requiredGateIds;
  if (canonicalJson([...snapshot.requiredGateIds].sort()) !==
    canonicalJson([...expected].sort()) || snapshot.evaluations.length !== expected.length) {
    throw conflict(`${checkpoint} required gate set 不完整或漂移`);
  }
}

async function assertManualCount(
  tx: Prisma.TransactionClient,
  row: GateRow,
  snapshot: DecisionSnapshot,
  currentPolicyId: string | null,
) {
  const summary = record(row.summary);
  const action = record(summary.decisionIdentity);
  const evidence = record(summary.evidenceIdentity);
  if (action.actionInputHash !== snapshot.actionInputHash ||
    action.requesterActorId !== snapshot.requesterActorId) {
    throw conflict(`${row.gateId} 人工确认动作身份已漂移`);
  }
  let required = 1;
  if (row.gateId === "C03") {
    required = positiveInteger(evidence.requiredIndependentApprovals);
    const policyId = string(evidence.sourcePolicyRevisionId);
    const policyHash = string(evidence.sourcePolicySnapshotHash);
    const policy = policyId && policyHash
      ? await tx.sourcePolicyRevision.findFirst({
          where: { id: policyId, snapshotHash: policyHash },
          select: { id: true, requiredIndependentApprovals: true },
        }) : null;
    if (!policy || currentPolicyId !== policy.id ||
      required !== policy.requiredIndependentApprovals) {
      throw conflict("C03 full SourcePolicy v2 reviewer 阈值已漂移");
    }
  }
  const valid = row.manualApprovals.filter((approval) =>
    approval.evaluationInputHash === row.inputHash &&
    approval.actionInputHash === snapshot.actionInputHash &&
    approval.requesterActorId === snapshot.requesterActorId &&
    approval.reviewerActorId !== snapshot.requesterActorId &&
    (!approval.expiresAt || approval.expiresAt.getTime() >= Date.now()) &&
    (row.gateId !== "C03" || (
      approval.sourcePolicyRevisionId === evidence.sourcePolicyRevisionId &&
      approval.sourcePolicySnapshotHash === evidence.sourcePolicySnapshotHash &&
      approval.sourceCommitSha === evidence.sourceCommitSha)),
  );
  if (!required || new Set(valid.map((item) => item.reviewerActorId)).size < required) {
    throw conflict(`${row.gateId} 独立人工确认数量不足或已过期`);
  }
}

type GateRow = {
  id: string; gateId: string; inputHash: string; definitionVersion: string;
  providerKey: string | null; expiresAt: Date | null; status: string; summary: unknown;
  manualApprovals: Array<{
    evaluationInputHash: string; actionInputHash: string;
    requesterActorId: string; reviewerActorId: string;
    sourcePolicyRevisionId: string | null; sourcePolicySnapshotHash: string | null;
    sourceCommitSha: string | null; expiresAt: Date | null;
  }>;
};
type DecisionSnapshot = {
  version: 3; checkpoint: ReleaseGateCheckpoint; requesterActorId: string;
  actionInputHash: string; requiredGateIds: string[];
  actionInput: Record<string, string | null>;
  evaluations: Array<{ gateId: string; evaluationId: string; evaluationInputHash: string }>;
};
function decisionSnapshot(value: unknown): DecisionSnapshot | null {
  const row = record(value);
  return row.version === 3 && typeof row.checkpoint === "string" &&
    typeof row.requesterActorId === "string" && typeof row.actionInputHash === "string" &&
    Array.isArray(row.requiredGateIds) && Array.isArray(row.evaluations)
    ? row as DecisionSnapshot : null;
}
function positiveInteger(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0; }
function string(value: unknown) { return typeof value === "string" && value ? value : null; }
function record(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function conflict(message: string) { return new ConflictException(message); }
