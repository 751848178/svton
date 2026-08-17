import { Prisma } from "@prisma/client";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import {
  RELEASE_GATE_CAPABILITY_VERSION,
  RELEASE_GATE_CATALOG_VERSION,
  type ReleaseGateEvaluation,
  type ReleaseGateStatus,
} from "./release-gate-catalog.types";

export const GATE_DEFINITION_VERSION =
  `${RELEASE_GATE_CATALOG_VERSION}:${RELEASE_GATE_CAPABILITY_VERSION}`;

export type PersistedGateStatus =
  | "pending"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "skipped"
  | "unavailable"
  | "needs_human";

export type GateEvaluationScope = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  releaseRunId?: string;
  buildRunId?: string;
  actorId?: string;
  decisionIdentity?: {
    checkpoint: string | null;
    deploymentRunId: string | null;
    candidateHash: string | null;
    approvalSubjectHash: string;
    actionInputHash: string;
    requesterActorId: string;
  };
};

export function buildGateEvaluationRow(
  scope: GateEvaluationScope,
  evaluation: ReleaseGateEvaluation,
): Prisma.GateEvaluationCreateManyInput {
  const { decisionIdentity, ...persistedScope } = scope;
  const status = persistedGateStatus(evaluation.status);
  const inputHash = stableHash({
    definitionVersion: GATE_DEFINITION_VERSION,
    subject: {
      releaseOrderId: scope.releaseOrderId,
      releaseRunId: scope.releaseRunId ?? null,
      buildRunId: scope.buildRunId ?? null,
      decisionIdentity: decisionIdentity ?? null,
    },
    gateId: evaluation.id,
    status,
    providerKey: evaluation.providerKey,
    reasonCode: evaluation.reasonCode,
    reason: evaluation.reason,
    evidenceRef: evaluation.evidenceRef,
    checkedAt: evaluation.checkedAt,
    expiresAt: evaluation.expiresAt,
    fresh: evaluation.fresh,
    evidenceIdentity: evaluation.evidenceIdentity ?? null,
  });
  return {
    ...persistedScope,
    gateId: evaluation.id,
    definitionVersion: GATE_DEFINITION_VERSION,
    status,
    providerKey: evaluation.providerKey,
    reasonCode: evaluation.reasonCode,
    summary: {
      reason: evaluation.reason,
      evidenceIdentity: evaluation.evidenceIdentity ?? null,
      decisionIdentity: decisionIdentity ?? null,
    } as Prisma.InputJsonValue,
    evidenceRef: evaluation.evidenceRef,
    checkedAt: parseDate(evaluation.checkedAt),
    expiresAt: parseDate(evaluation.expiresAt),
    sourceSystem: evaluation.providerKey ?? "devpilot.gate-catalog",
    inputHash,
  };
}

export function persistedGateStatus(status: ReleaseGateStatus): PersistedGateStatus {
  return {
    checked: "passed",
    unchecked: "pending",
    blocked: "failed",
    warning: "warning",
    manual: "needs_human",
    unavailable: "unavailable",
  }[status] as PersistedGateStatus;
}

function parseDate(value: string | null) {
  return value ? new Date(value) : undefined;
}
