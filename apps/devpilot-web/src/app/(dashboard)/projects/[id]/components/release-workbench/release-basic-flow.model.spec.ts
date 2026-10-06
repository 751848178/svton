import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { basicReleaseStageViews } from './release-basic-flow.model';

describe('basicReleaseStageViews', () => {
  it('starts with staging build and keeps production disabled', () => {
    const stages = views();
    expect(stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['staging', 'current'],
      ['production', 'disabled'],
    ]);
    expect(stages[0]?.steps.map((step) => [step.key, step.state])).toEqual([
      ['build', 'available'],
      ['stagingDeploy', 'disabled'],
    ]);
  });

  it('shows only build and deploy inside staging', () => {
    const build = successfulBuild();
    const stages = views({ latestBuild: build, deployableBuild: build });
    expect(stages[0]?.steps.map((step) => step.key)).toEqual(['build', 'stagingDeploy']);
    expect(stages[0]?.steps[1]?.state).toBe('available');
  });

  it('unlocks one production deploy step after staging deployment succeeds', () => {
    const build = successfulBuild();
    const stages = views({
      latestBuild: build,
      deployableBuild: build,
      latestDeployment: { status: 'completed' } as ReleaseStagingDeploymentItem,
    });
    expect(stages[0]?.state).toBe('done');
    expect(stages[1]?.state).toBe('available');
    expect(stages[1]?.steps.map((step) => step.key)).toEqual(['productionDeploy']);
  });

  it('derives production completion from the production run without adding a build', () => {
    const build = successfulBuild();
    const stages = views({
      latestBuild: build,
      deployableBuild: build,
      latestDeployment: { status: 'completed' } as ReleaseStagingDeploymentItem,
      latestProductionRun: { status: 'succeeded' } as ReleaseEvidenceProductionRun,
    });
    expect(stages[1]).toMatchObject({
      key: 'production',
      state: 'done',
      steps: [{ key: 'productionDeploy', state: 'done' }],
    });
  });
});

function views(overrides: Partial<Parameters<typeof basicReleaseStageViews>[0]> = {}) {
  return basicReleaseStageViews({
    latestBuild: null,
    deployableBuild: null,
    latestDeployment: null,
    latestProductionRun: null,
    building: false,
    deploying: false,
    ...overrides,
  });
}

function successfulBuild() {
  return { status: 'succeeded', manifest: { id: 'manifest-1' } } as ReleaseBuildItem;
}
