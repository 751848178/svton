import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGateDecision,
  ReleaseGateDecisionStage,
} from '../../types/release-gate.types';

export type ReleasePreflightImpact =
  | 'blocker'
  | 'manual'
  | 'confirmed'
  | 'warning'
  | 'deferred'
  | 'evidenceOnly'
  | 'nonBlocking';

export type ReleasePreflightCheckRow = {
  check: ReleaseGateCheck;
  impact: ReleasePreflightImpact;
};

export function releasePreflightDecision(
  catalog: ReleaseGateCatalog,
  stage: ReleaseGateDecisionStage,
): ReleaseGateDecision | null {
  return catalog.decisions?.[stage] ?? null;
}

export function releasePreflightCheckRows(
  catalog: ReleaseGateCatalog,
  stage: ReleaseGateDecisionStage,
): ReleasePreflightCheckRow[] {
  const decision = releasePreflightDecision(catalog, stage);
  if (!decision) return [];
  const checks =
    decision.evaluations !== undefined
      ? decision.evaluations
          .map((evaluation) => {
            const check = catalog.checks.find((item) => item.id === evaluation.gateId);
            return check
              ? {
                  ...check,
                  evaluationId: evaluation.evaluationId,
                  evaluationInputHash: evaluation.evaluationInputHash,
                  status: evaluation.status,
                  providerKey: evaluation.providerKey,
                  reasonCode: evaluation.reasonCode,
                  reason: evaluation.reason,
                  evidenceRef: evaluation.evidenceRef,
                  checkedAt: evaluation.checkedAt,
                  expiresAt: evaluation.expiresAt,
                  fresh: evaluation.fresh,
                  waiver: evaluation.waiver,
                  waiverExpiresAt: evaluation.waiverExpiresAt,
                }
              : null;
          })
          .filter((check): check is ReleaseGateCheck => Boolean(check))
      : catalog.checks.filter((check) => check.phase === decision.phase);
  return checks
    .map((check) => ({ check, impact: decisionImpact(decision, check.id) }))
    .sort((left, right) => left.check.ordinal - right.check.ordinal);
}

function decisionImpact(decision: ReleaseGateDecision, gateId: string): ReleasePreflightImpact {
  if (decision.blockerGateIds.includes(gateId)) return 'blocker';
  if (decision.manualGateIds.includes(gateId)) return 'manual';
  if (decision.confirmedManualGateIds.includes(gateId)) return 'confirmed';
  if (decision.warningGateIds.includes(gateId)) return 'warning';
  if (decision.deferredGateIds.includes(gateId)) return 'deferred';
  if (decision.evidenceOnlyGateIds.includes(gateId)) return 'evidenceOnly';
  return 'nonBlocking';
}
