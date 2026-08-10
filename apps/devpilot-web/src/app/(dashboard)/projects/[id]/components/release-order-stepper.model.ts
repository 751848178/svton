import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import { releaseOrderFailureLabelKey } from '../utils/release-order.utils';

export const RELEASE_ORDER_STEPS: ReleaseOrderStep[] = [
  'preflight',
  'build',
  'staging',
  'production',
];

export type ReleaseOrderStepState = 'completed' | 'current' | 'waiting' | 'blocked';

type StepLabelKey =
  | 'releaseStepPreflightTitle'
  | 'releaseStepBuildTitle'
  | 'releaseStepStagingTitle'
  | 'releaseStepProductionTitle';

type StepStateLabelKey =
  | 'releaseStepStateCompleted'
  | 'releaseStepStateBaselineEstablished'
  | 'releaseStepStateCurrent'
  | 'releaseStepStateWaiting'
  | 'releaseOrderFailureFailed'
  | 'releaseOrderFailureBlocked'
  | 'releaseOrderFailureCanceled'
  | 'releaseOrderFailureEvidenceMismatch'
  | 'releaseOrderStatusWithdrawn'
  | 'releaseOrderStatusDraft'
  | 'releaseOrderStatusBuilding'
  | 'releaseOrderStatusStaging'
  | 'releaseOrderStatusAwaitingApproval'
  | 'releaseOrderStatusProduction'
  | 'releaseOrderStatusSucceeded'
  | 'releaseOrderStatusFailed';

type StepSummary = {
  key:
    | 'releaseStepPreflightReadyEvidence'
    | 'releaseStepPreflightWaitingEvidence'
    | 'releaseStepBuildEvidence'
    | 'releaseStepStagingReachedEvidence'
    | 'releaseStepStagingWaitingEvidence'
    | 'releaseStepProductionReachedEvidence'
    | 'releaseStepProductionWaitingEvidence'
    | 'releaseStepProductionRunsEvidence';
  values?: Record<string, number>;
};

export interface ReleaseOrderStepView {
  key: ReleaseOrderStep;
  number: number;
  labelKey: StepLabelKey;
  state: ReleaseOrderStepState;
  stateLabelKey: StepStateLabelKey;
  summary: StepSummary;
  isCurrent: boolean;
}

export function buildReleaseOrderStepViews(detail: ReleaseOrderDetail): ReleaseOrderStepView[] {
  return RELEASE_ORDER_STEPS.map((key, index) => {
    const state = resolveStepState(detail, key);
    return {
      key,
      number: index + 1,
      labelKey: STEP_LABELS[key],
      state,
      stateLabelKey: resolveStateLabel(detail, key, state),
      summary: resolveSummary(detail, key),
      isCurrent: key === detail.resumeStep,
    };
  });
}

export function releaseOrderStepLabelKey(step: ReleaseOrderStep): StepLabelKey {
  return STEP_LABELS[step];
}

function resolveStepState(
  detail: ReleaseOrderDetail,
  step: ReleaseOrderStep,
): ReleaseOrderStepState {
  const failedHere = Boolean(detail.lifecycle.failureKind) && detail.lifecycle.phase === step;
  const withdrawnHere = detail.lifecycle.status === 'withdrawn' && detail.resumeStep === step;
  if (failedHere || withdrawnHere) return 'blocked';
  const rank = RELEASE_ORDER_STEPS.indexOf(step);
  const resumeRank = RELEASE_ORDER_STEPS.indexOf(detail.resumeStep);
  if (rank < resumeRank) return 'completed';
  return rank === resumeRank ? 'current' : 'waiting';
}

function resolveStateLabel(
  detail: ReleaseOrderDetail,
  step: ReleaseOrderStep,
  state: ReleaseOrderStepState,
): StepStateLabelKey {
  if (state === 'blocked') {
    if (detail.lifecycle.phase === step) {
      return (
        releaseOrderFailureLabelKey(detail.lifecycle.failureKind) || 'releaseOrderStatusWithdrawn'
      );
    }
    return 'releaseOrderStatusWithdrawn';
  }
  if (state === 'completed') {
    return step === 'preflight'
      ? 'releaseStepStateBaselineEstablished'
      : 'releaseStepStateCompleted';
  }
  if (state === 'current' && detail.lifecycle.phase === step) {
    return LIFECYCLE_STATUS_LABELS[detail.lifecycle.status];
  }
  return state === 'current' ? 'releaseStepStateCurrent' : 'releaseStepStateWaiting';
}

function resolveSummary(detail: ReleaseOrderDetail, step: ReleaseOrderStep): StepSummary {
  if (step === 'preflight') {
    return {
      key: detail.preflight.ready
        ? 'releaseStepPreflightReadyEvidence'
        : 'releaseStepPreflightWaitingEvidence',
    };
  }
  if (step === 'build') {
    return {
      key: 'releaseStepBuildEvidence',
      values: { buildRuns: detail.counts.buildRuns, manifests: detail.counts.manifests },
    };
  }
  const reached = stepRank(detail.resumeStep) >= stepRank(step);
  if (step === 'staging') {
    return {
      key: reached ? 'releaseStepStagingReachedEvidence' : 'releaseStepStagingWaitingEvidence',
    };
  }
  if (detail.counts.releaseRuns > 0) {
    return {
      key: 'releaseStepProductionRunsEvidence',
      values: { count: detail.counts.releaseRuns },
    };
  }
  return {
    key: reached ? 'releaseStepProductionReachedEvidence' : 'releaseStepProductionWaitingEvidence',
  };
}

function stepRank(step: ReleaseOrderStep) {
  return RELEASE_ORDER_STEPS.indexOf(step);
}

const STEP_LABELS: Record<ReleaseOrderStep, StepLabelKey> = {
  preflight: 'releaseStepPreflightTitle',
  build: 'releaseStepBuildTitle',
  staging: 'releaseStepStagingTitle',
  production: 'releaseStepProductionTitle',
};

const LIFECYCLE_STATUS_LABELS: Record<
  ReleaseOrderDetail['lifecycle']['status'],
  StepStateLabelKey
> = {
  draft: 'releaseOrderStatusDraft',
  building: 'releaseOrderStatusBuilding',
  staging: 'releaseOrderStatusStaging',
  awaiting_approval: 'releaseOrderStatusAwaitingApproval',
  production: 'releaseOrderStatusProduction',
  succeeded: 'releaseOrderStatusSucceeded',
  failed: 'releaseOrderStatusFailed',
  withdrawn: 'releaseOrderStatusWithdrawn',
};
