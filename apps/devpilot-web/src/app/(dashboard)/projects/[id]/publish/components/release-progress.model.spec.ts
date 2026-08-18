import { describe, expect, it } from 'vitest';
import { buildReleaseProgressView } from './release-progress.model';
import { build, detail, productionRun, staging } from './release-progress.model.spec-fixtures';

describe('buildReleaseProgressView', () => {
  it('marks preflight failed with the first unready area code', () => {
    const view = buildReleaseProgressView({
      detail: detail({
        preflight: {
          ready: false,
          repository: {
            ready: true,
            branch: null,
            identityRevisionId: null,
            identityRevision: null,
          },
          staging: { ready: false },
          production: { ready: true },
        },
      }),
      builds: [],
      stagingDeployments: [],
      productionRuns: [],
    });
    expect(view.steps[0]).toMatchObject({ status: 'failed', reasonCode: 'preflight_staging' });
    expect(view.steps.slice(1).every((step) => step.status === 'pending')).toBe(true);
  });

  it('maps a succeeded build to a succeeded build step', () => {
    const view = buildReleaseProgressView({
      detail: detail(),
      builds: [build('succeeded')],
      stagingDeployments: [],
      productionRuns: [],
    });
    expect(view.steps[1]).toMatchObject({ status: 'succeeded' });
    expect(view.canPublishToProduction).toBe(false);
  });

  it('surfaces build failure reason text', () => {
    const view = buildReleaseProgressView({
      detail: detail(),
      builds: [build('failed', { errorMessage: '依赖安装失败', errorCode: 'BUILD_EXIT_NONZERO' })],
      stagingDeployments: [],
      productionRuns: [],
    });
    expect(view.steps[1]).toMatchObject({ status: 'failed', reasonText: '依赖安装失败' });
    expect(view.canRollback).toBe(false);
  });

  it('shows awaiting approval for pending production approval and keeps polling', () => {
    const view = buildReleaseProgressView({
      detail: detail({
        lifecycle: { ...detail().lifecycle, status: 'awaiting_approval', phase: 'production' },
      }),
      builds: [],
      stagingDeployments: [],
      productionRuns: [
        productionRun({
          status: 'awaiting_approval',
          operationApproval: {
            id: 'ap-1',
            status: 'pending',
            inputHash: 'h1',
            requestedAt: '2026-08-16T01:00:00Z',
          },
        }),
      ],
    });
    expect(view.steps[3]).toMatchObject({ status: 'awaiting_approval' });
    expect(view.awaitingApproval).toBe(true);
    expect(view.running).toBe(true);
    expect(view.canPublishToProduction).toBe(false);
  });

  it('exposes 发布到生产 once staging succeeded without a production run', () => {
    const view = buildReleaseProgressView({
      detail: detail(),
      builds: [build('succeeded')],
      stagingDeployments: [staging('succeeded')],
      productionRuns: [],
    });
    expect(view.stagingSucceeded).toBe(true);
    expect(view.canPublishToProduction).toBe(true);
    expect(view.terminal).toBe(false);
  });

  it('allows rollback after a failed staging deployment', () => {
    const view = buildReleaseProgressView({
      detail: detail(),
      builds: [build('succeeded')],
      stagingDeployments: [staging('failed')],
      productionRuns: [],
    });
    expect(view.steps[2]).toMatchObject({ status: 'failed' });
    expect(view.canRollback).toBe(true);
  });

  it('reports terminal success when production completed', () => {
    const view = buildReleaseProgressView({
      detail: detail({
        lifecycle: { ...detail().lifecycle, status: 'succeeded', phase: 'production' },
      }),
      builds: [build('succeeded')],
      stagingDeployments: [staging('succeeded')],
      productionRuns: [productionRun({ status: 'succeeded' })],
    });
    expect(view.productionSucceeded).toBe(true);
    expect(view.terminal).toBe(true);
    expect(view.running).toBe(false);
  });
});
