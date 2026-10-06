import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { isReleaseStagingActive } from '../../utils/release-staging-view.model';
import { isReleaseBuildActive } from '../release-build-view.model';

export type BasicReleaseStage = 'staging' | 'production';
export type BasicReleaseStep = 'build' | 'stagingDeploy' | 'productionDeploy';
export type BasicReleaseState = 'available' | 'blocked' | 'current' | 'disabled' | 'done';

export interface BasicReleaseStepView {
  key: BasicReleaseStep;
  labelKey: string;
  state: BasicReleaseState;
}

export interface BasicReleaseStageView {
  key: BasicReleaseStage;
  labelKey: string;
  descriptionKey: string;
  state: BasicReleaseState;
  steps: BasicReleaseStepView[];
}

export function basicReleaseStageViews(input: {
  latestBuild: ReleaseBuildItem | null;
  deployableBuild: ReleaseBuildItem | null;
  latestDeployment: ReleaseStagingDeploymentItem | null;
  latestProductionRun: ReleaseEvidenceProductionRun | null;
  building: boolean;
  deploying: boolean;
}): BasicReleaseStageView[] {
  const build = buildState(input.latestBuild, input.building);
  const stagingDeploy = stagingDeploymentState(input);
  const productionDeploy = productionDeploymentState(stagingDeploy, input.latestProductionRun);
  return [
    stage('staging', aggregateStageState([build, stagingDeploy]), [
      step('build', 'releaseBasicStep.build.label', build),
      step('stagingDeploy', 'releaseBasicStep.deploy.label', stagingDeploy),
    ]),
    stage('production', productionDeploy, [
      step('productionDeploy', 'releaseLifecycleStep.productionDeploy.label', productionDeploy),
    ]),
  ];
}

function buildState(build: ReleaseBuildItem | null, building: boolean): BasicReleaseState {
  if (building || (build && isReleaseBuildActive(build.status))) return 'current';
  if (build?.status === 'succeeded') return 'done';
  if (build && ['failed', 'canceled', 'cancelled'].includes(build.status)) return 'blocked';
  return 'available';
}

function stagingDeploymentState(input: {
  deployableBuild: ReleaseBuildItem | null;
  latestDeployment: ReleaseStagingDeploymentItem | null;
  deploying: boolean;
}): BasicReleaseState {
  const run = input.latestDeployment;
  if (input.deploying || (run && isReleaseStagingActive(run.status))) return 'current';
  if (run && ['completed', 'succeeded'].includes(run.status.toLowerCase())) return 'done';
  if (run && ['failed', 'cancelled', 'canceled'].includes(run.status.toLowerCase()))
    return 'blocked';
  return input.deployableBuild ? 'available' : 'disabled';
}

function productionDeploymentState(
  stagingDeploy: BasicReleaseState,
  run: ReleaseEvidenceProductionRun | null,
): BasicReleaseState {
  if (stagingDeploy !== 'done') return 'disabled';
  if (!run) return 'available';
  const status = run.status.toLowerCase();
  if (status === 'succeeded') return 'done';
  if (run.promotionBlocker || ['failed', 'blocked', 'cancelled', 'canceled'].includes(status)) {
    return 'blocked';
  }
  return 'current';
}

function aggregateStageState(states: BasicReleaseState[]): BasicReleaseState {
  if (states.every((state) => state === 'done')) return 'done';
  if (states.includes('blocked')) return 'blocked';
  return 'current';
}

function stage(
  key: BasicReleaseStage,
  state: BasicReleaseState,
  steps: BasicReleaseStepView[],
): BasicReleaseStageView {
  return {
    key,
    labelKey: `releaseLifecycleStage.${key}.label`,
    descriptionKey: `releaseLifecycleStage.${key}.description`,
    state,
    steps,
  };
}

function step(key: BasicReleaseStep, labelKey: string, state: BasicReleaseState) {
  return { key, labelKey, state };
}
