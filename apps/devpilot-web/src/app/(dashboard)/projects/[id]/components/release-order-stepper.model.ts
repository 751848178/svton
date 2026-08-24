import type { ReleaseOrderStep } from '../types/release-order.types';

type StepLabelKey =
  | 'releaseStepPreflightTitle'
  | 'releaseStepBuildTitle'
  | 'releaseStepStagingTitle'
  | 'releaseStepProductionTitle';

const STEP_LABELS: Record<ReleaseOrderStep, StepLabelKey> = {
  preflight: 'releaseStepPreflightTitle',
  build: 'releaseStepBuildTitle',
  staging: 'releaseStepStagingTitle',
  production: 'releaseStepProductionTitle',
};

/** 发布单生命周期步骤（含生产）的展示名；预发工作台三步模型见 release-workbench-steps.model。 */
export function releaseOrderStepLabelKey(step: ReleaseOrderStep): StepLabelKey {
  return STEP_LABELS[step];
}

export type ReleaseOrderStepLabelKey = StepLabelKey;
