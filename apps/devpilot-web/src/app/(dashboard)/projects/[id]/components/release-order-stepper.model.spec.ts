import { describe, expect, it } from 'vitest';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { buildReleaseOrderStepViews } from './release-order-stepper.model';

describe('release order stepper model', () => {
  it.each([
    ['preflight', ['current', 'waiting', 'waiting', 'waiting']],
    ['build', ['completed', 'current', 'waiting', 'waiting']],
    ['staging', ['completed', 'completed', 'current', 'waiting']],
    ['production', ['completed', 'completed', 'completed', 'current']],
  ] as const)('maps resume %s to ordered progress', (resumeStep, expected) => {
    expect(buildReleaseOrderStepViews(detail({ resumeStep })).map((step) => step.state)).toEqual(
      expected,
    );
  });

  it('keeps a lower retry failure blocked while the furthest evidence remains current', () => {
    const steps = buildReleaseOrderStepViews(
      detail({
        resumeStep: 'staging',
        lifecycle: { phase: 'build', status: 'failed', failureKind: 'blocked' },
      }),
    );
    expect(steps.map((step) => step.state)).toEqual(['completed', 'blocked', 'current', 'waiting']);
    expect(steps.find((step) => step.isCurrent)?.key).toBe('staging');
    expect(steps[1]?.stateLabelKey).toBe('releaseOrderFailureBlocked');
  });

  it('places a Production evidence mismatch on the Production step', () => {
    const steps = buildReleaseOrderStepViews(
      detail({
        resumeStep: 'production',
        lifecycle: {
          phase: 'production',
          status: 'failed',
          failureKind: 'evidence_mismatch',
        },
      }),
    );
    expect(steps[3]).toMatchObject({
      state: 'blocked',
      isCurrent: true,
      stateLabelKey: 'releaseOrderFailureEvidenceMismatch',
    });
  });

  it('uses a truthful latest lifecycle status when the current step owns it', () => {
    const steps = buildReleaseOrderStepViews(
      detail({
        resumeStep: 'production',
        lifecycle: { phase: 'production', status: 'awaiting_approval' },
      }),
    );
    expect(steps[3]).toMatchObject({
      state: 'current',
      stateLabelKey: 'releaseOrderStatusAwaitingApproval',
    });
  });

  it('renders a withdrawn recovery anchor as blocked', () => {
    const steps = buildReleaseOrderStepViews(
      detail({ resumeStep: 'build', lifecycle: { phase: 'production', status: 'withdrawn' } }),
    );
    expect(steps[1]).toMatchObject({
      state: 'blocked',
      isCurrent: true,
      stateLabelKey: 'releaseOrderStatusWithdrawn',
    });
  });

  it('uses only truthful compact counts and reached evidence', () => {
    const steps = buildReleaseOrderStepViews(
      detail({ resumeStep: 'production', counts: { buildRuns: 7, manifests: 3, releaseRuns: 0 } }),
    );
    expect(steps[1]?.summary).toEqual({
      key: 'releaseStepBuildEvidence',
      values: { buildRuns: 7, manifests: 3 },
    });
    expect(steps[2]?.summary.key).toBe('releaseStepStagingReachedEvidence');
    expect(steps[3]?.summary.key).toBe('releaseStepProductionReachedEvidence');
  });
});

type Overrides = Partial<Omit<ReleaseOrderDetail, 'lifecycle'>> & {
  lifecycle?: Partial<ReleaseOrderDetail['lifecycle']>;
};

function detail(overrides: Overrides = {}): ReleaseOrderDetail {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '2.4.0',
    note: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
    counts: { buildRuns: 0, manifests: 0, releaseRuns: 0 },
    persistedStatus: 'active',
    resumeStep: 'preflight',
    preflight: {
      ready: true,
      repository: { ready: true, branch: 'main', identityRevisionId: 'r1', identityRevision: 1 },
      staging: { ready: true },
      production: { ready: true },
    },
    ...overrides,
    lifecycle: {
      phase: 'preflight',
      status: 'draft',
      sourceType: 'order_created',
      sourceId: 'order-1',
      sourceStatus: 'active',
      occurredAt: '2026-08-05T01:00:00.000Z',
      ...overrides.lifecycle,
    },
  };
}
