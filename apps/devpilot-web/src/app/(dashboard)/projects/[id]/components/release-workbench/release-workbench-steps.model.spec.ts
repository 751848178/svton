import { describe, expect, it } from 'vitest';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../../types/release-order.types';
import { buildReleaseWorkbenchStepViews } from './release-workbench-steps.model';

describe('buildReleaseWorkbenchStepViews', () => {
  it('exposes exactly three steps: preflight, build, deploy', () => {
    const views = buildReleaseWorkbenchStepViews(detail('preflight'));
    expect(views.map((view) => view.key)).toEqual(['preflight', 'build', 'staging']);
    expect(views.map((view) => view.labelKey)).toEqual([
      'releaseWorkbenchStepPreflight',
      'releaseWorkbenchStepBuild',
      'releaseWorkbenchStepDeploy',
    ]);
  });

  it('marks earlier steps completed as the lifecycle advances', () => {
    const views = buildReleaseWorkbenchStepViews(detail('staging'));
    expect(states(views)).toEqual(['completed', 'completed', 'current']);
    expect(views[2]?.isCurrent).toBe(true);
  });

  it('treats the production phase as deploy completed in the staging workbench', () => {
    const views = buildReleaseWorkbenchStepViews(detail('production'));
    expect(states(views)).toEqual(['completed', 'completed', 'completed']);
    expect(views.every((view) => !view.isCurrent)).toBe(true);
  });

  it('blocks the failing step and labels it with the failure reason', () => {
    const failing = {
      ...detail('build'),
      lifecycle: { ...detail('build').lifecycle, status: 'failed', failureKind: 'failed' },
    } as ReleaseOrderDetail;
    const views = buildReleaseWorkbenchStepViews(failing);
    expect(states(views)).toEqual(['completed', 'blocked', 'waiting']);
    expect(views[1]?.stateLabelKey).toBe('releaseOrderFailureFailed');
  });

  it('blocks the withdrawn step without inventing a later current step', () => {
    const withdrawn = detail('build');
    withdrawn.lifecycle.status = 'withdrawn';
    const views = buildReleaseWorkbenchStepViews(withdrawn);
    expect(states(views)).toEqual(['completed', 'blocked', 'waiting']);
    expect(views[1]?.stateLabelKey).toBe('releaseOrderStatusWithdrawn');
  });
});

function states(views: ReturnType<typeof buildReleaseWorkbenchStepViews>) {
  return views.map((view) => view.state);
}

function detail(resumeStep: ReleaseOrderStep): ReleaseOrderDetail {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
    counts: { buildRuns: 1, manifests: 1, releaseRuns: 0 },
    persistedStatus: 'active',
    lifecycle: {
      status: resumeStep === 'preflight' ? 'draft' : 'building',
      phase: 'build',
      failureKind: null,
    },
    resumeStep,
    preflight: {
      ready: true,
      repository: { ready: true, branch: 'main', identityRevisionId: 'r1', identityRevision: 1 },
      staging: { ready: true },
      production: { ready: true },
    },
  } as unknown as ReleaseOrderDetail;
}
