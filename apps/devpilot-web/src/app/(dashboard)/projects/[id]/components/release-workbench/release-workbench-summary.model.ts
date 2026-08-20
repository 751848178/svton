import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseGateCatalog, ReleaseGateDecisionStage } from '../../types/release-gate.types';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../../types/release-order.types';

export interface ReleaseWorkbenchGateSummary {
  stage: ReleaseGateDecisionStage;
  state: 'loading' | 'error' | 'ready' | 'blocked';
  blockerCount: number;
  warningCount: number;
  manualCount: number;
  reason: string | null;
}

export function buildReleaseWorkbenchGateSummary(input: {
  step: ReleaseOrderStep;
  catalog: ReleaseGateCatalog | null;
  loading: boolean;
  error: string;
  locale: string;
}): ReleaseWorkbenchGateSummary {
  const stage = gateStage(input.step);
  if (input.loading) return emptyGate(stage, 'loading');
  if (input.error || !input.catalog) {
    return { ...emptyGate(stage, 'error'), reason: input.error || null };
  }
  const decision = input.catalog.decisions[stage];
  if (!decision) return emptyGate(stage, 'error');
  const blockerCount = decision.blockerGateIds.length + decision.integrityErrors.length;
  const pendingManualIds = (decision.manualGateIds ?? []).filter(
    (gateId) => !(decision.confirmedManualGateIds ?? []).includes(gateId),
  );
  const blockingGateIds = [
    ...decision.blockerGateIds,
    ...pendingManualIds,
    ...(decision.deferredGateIds ?? []),
  ];
  const firstBlocker = input.catalog.checks.find((check) =>
    blockingGateIds.includes(check.id),
  );
  const reason = firstBlocker
    ? input.locale.startsWith('zh')
      ? firstBlocker.reason.zh
      : firstBlocker.reason.en
    : decision.integrityErrors[0] || null;
  return {
    stage,
    state: decision.allowed && blockerCount === 0 ? 'ready' : 'blocked',
    blockerCount,
    warningCount: decision.warningGateIds.length,
    manualCount: pendingManualIds.length,
    reason,
  };
}

export function latestReleaseManifest(evidence: ReleaseOrderEvidence | null) {
  const frozenManifest = [...(evidence?.productionReleaseRuns?.items ?? [])].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )[0]?.manifest;
  if (frozenManifest) return frozenManifest;
  return (
    evidence?.buildRuns.items
      .filter((run) => run.manifest)
      .sort(
        (left, right) =>
          (right.revision ?? 0) - (left.revision ?? 0) ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )[0]
      ?.manifest ?? null
  );
}

export function releaseWorkbenchDecisionStep(detail: ReleaseOrderDetail): ReleaseOrderStep {
  return detail.lifecycle.failureKind ? detail.lifecycle.phase : detail.resumeStep;
}

function gateStage(step: ReleaseOrderStep): ReleaseGateDecisionStage {
  if (step === 'staging') return 'staging';
  if (step === 'production') return 'production';
  return 'build';
}

function emptyGate(
  stage: ReleaseGateDecisionStage,
  state: ReleaseWorkbenchGateSummary['state'],
): ReleaseWorkbenchGateSummary {
  return { stage, state, blockerCount: 0, warningCount: 0, manualCount: 0, reason: null };
}
