import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { buildReleaseWorkbenchStepViews } from './release-workbench-steps.model';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';

export const RELEASE_LIFECYCLE_STAGES = [
  'staging',
  'production',
  'validation',
  'complete',
] as const;

export type ReleaseLifecycleStage = (typeof RELEASE_LIFECYCLE_STAGES)[number];
export type ReleaseLifecycleState = 'done' | 'current' | 'available' | 'blocked' | 'disabled';
export type ReleaseLifecycleStep =
  | 'preflight'
  | 'build'
  | 'stagingDeploy'
  | 'stagingValidation'
  | 'productionCheck'
  | 'productionDeploy'
  | 'postReleaseValidation'
  | 'resultConfirmation';

export interface ReleaseLifecycleStepView {
  key: ReleaseLifecycleStep;
  labelKey: string;
  descriptionKey: string;
  state: ReleaseLifecycleState;
}

export interface ReleaseLifecycleStageView {
  key: ReleaseLifecycleStage;
  labelKey: string;
  descriptionKey: string;
  state: ReleaseLifecycleState;
  steps: ReleaseLifecycleStepView[];
}

export function buildReleaseLifecycleViews(input: {
  detail: ReleaseOrderDetail;
  evidence: ReleaseLifecycleEvidence;
}): ReleaseLifecycleStageView[] {
  const stagingDone = input.evidence.staging === 'passed';
  const production = productionState(input.evidence, stagingDone);
  const validation = validationState(input.evidence);
  const complete = input.evidence.completed
    ? 'done'
    : input.evidence.staging === 'passed' &&
        input.evidence.production === 'passed' &&
        input.evidence.validation === 'passed'
      ? 'current'
      : 'disabled';

  return [
    stage('staging', stagingState(input.detail, stagingDone), stagingSteps(input, stagingDone)),
    stage('production', production, productionSteps(input.evidence, stagingDone)),
    stage('validation', validation, [step('postReleaseValidation', validation)]),
    stage('complete', complete, [step('resultConfirmation', complete)]),
  ];
}

function stage(
  key: ReleaseLifecycleStage,
  state: ReleaseLifecycleState,
  steps: ReleaseLifecycleStepView[],
): ReleaseLifecycleStageView {
  return {
    key,
    state,
    labelKey: `releaseLifecycleStage.${key}.label`,
    descriptionKey: `releaseLifecycleStage.${key}.description`,
    steps,
  };
}

function step(key: ReleaseLifecycleStep, state: ReleaseLifecycleState): ReleaseLifecycleStepView {
  return {
    key,
    state,
    labelKey: `releaseLifecycleStep.${key}.label`,
    descriptionKey: `releaseLifecycleStep.${key}.description`,
  };
}

function stagingState(detail: ReleaseOrderDetail, done: boolean): ReleaseLifecycleState {
  if (done) return 'done';
  if (detail.lifecycle.phase === 'staging' && detail.lifecycle.failureKind) return 'blocked';
  return 'current';
}

function stagingSteps(
  input: Parameters<typeof buildReleaseLifecycleViews>[0],
  stagingDone: boolean,
): ReleaseLifecycleStepView[] {
  const existing = buildReleaseWorkbenchStepViews(input.detail);
  const stateFor = (key: 'preflight' | 'build' | 'staging') =>
    mapWorkbenchState(existing.find((item) => item.key === key)?.state ?? 'waiting');
  const validation = input.evidence.staging;
  return [
    step('preflight', stateFor('preflight')),
    step('build', stateFor('build')),
    step('stagingDeploy', stateFor('staging')),
    step(
      'stagingValidation',
      stagingDone
        ? 'done'
        : validation === 'failed'
          ? 'blocked'
          : validation === 'ready'
            ? 'current'
            : 'disabled',
    ),
  ];
}

function productionState(
  evidence: ReleaseLifecycleEvidence,
  stagingDone: boolean,
): ReleaseLifecycleState {
  if (!stagingDone) return evidence.productionRun ? 'blocked' : 'disabled';
  if (!evidence.productionRun) return 'available';
  if (evidence.production === 'passed') return 'done';
  return evidence.production === 'failed' ? 'blocked' : 'current';
}

function productionSteps(
  evidence: ReleaseLifecycleEvidence,
  stagingDone: boolean,
): ReleaseLifecycleStepView[] {
  if (!stagingDone) {
    const state = evidence.productionRun ? 'blocked' : 'disabled';
    return [step('productionCheck', state), step('productionDeploy', 'disabled')];
  }
  if (!evidence.productionRun) {
    return [step('productionCheck', 'current'), step('productionDeploy', 'disabled')];
  }
  if (evidence.productionRun.promotionBlocker) {
    return [step('productionCheck', 'blocked'), step('productionDeploy', 'disabled')];
  }
  const state = productionState(evidence, true);
  return [step('productionCheck', 'done'), step('productionDeploy', state)];
}

function validationState(evidence: ReleaseLifecycleEvidence): ReleaseLifecycleState {
  if (evidence.staging !== 'passed' || evidence.production !== 'passed') return 'disabled';
  if (evidence.validation === 'passed') return 'done';
  return evidence.validation === 'failed' ? 'blocked' : 'current';
}

function mapWorkbenchState(state: string): ReleaseLifecycleState {
  if (state === 'completed') return 'done';
  if (state === 'waiting') return 'available';
  return state === 'blocked' ? 'blocked' : 'current';
}
