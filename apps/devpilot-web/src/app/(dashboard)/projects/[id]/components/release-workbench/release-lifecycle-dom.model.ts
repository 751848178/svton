import type { ReleaseLifecycleStage, ReleaseLifecycleStep } from './release-lifecycle.model';

export const releaseLifecycleStageTabId = (stage: ReleaseLifecycleStage) =>
  `release-lifecycle-stage-tab-${stage}`;

export const releaseLifecycleStagePanelId = (stage: ReleaseLifecycleStage) =>
  `release-lifecycle-stage-panel-${stage}`;

export const releaseLifecycleStepTabId = (step: ReleaseLifecycleStep) =>
  `release-lifecycle-step-tab-${step}`;

export const releaseLifecycleStepPanelId = (step: ReleaseLifecycleStep) =>
  `release-lifecycle-step-panel-${step}`;
