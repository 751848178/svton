import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseBasicStagingStage } from './release-basic-staging-stage';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./release-basic-build-panel', () => ({ ReleaseBasicBuildPanel: () => null }));
vi.mock('./release-step-deploy-panel', () => ({ ReleaseStepDeployPanel: () => null }));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseBasicStagingStage', () => {
  it('keeps the staging deploy action disabled after a completed run', () => {
    const html = renderStage([deployment('completed')]);
    expect(html).toContain('releaseBasicDeployCompleted');
    expect(html).toContain('releaseBasicDeployedAction');
    expect(html).toContain('disabled=""');
  });

  it('keeps the staging deploy action available before the first run', () => {
    const html = renderStage([]);
    expect(html).toContain('releaseBasicDeployActionReady');
    expect(html).toContain('releaseBasicDeployAction');
    expect(html).not.toContain('disabled=""');
  });

  it('shows a disabled loading action for an active persisted run', () => {
    const html = renderStage([deployment('running')]);
    expect(html).toContain('releaseBasicDeployingAction');
    expect(html).toContain('disabled=""');
  });
});

function renderStage(items: unknown[]) {
  return renderToStaticMarkup(
    <ReleaseBasicStagingStage
      activeStep="stagingDeploy"
      detail={{ counts: { releaseRuns: 0 } } as never}
      builds={
        {
          items: [
            {
              id: 'build-1',
              revision: 1,
              status: 'succeeded',
              createdAt: '2026-09-03T00:00:00.000Z',
              manifest: { id: 'manifest-1' },
            },
          ],
          building: false,
        } as never
      }
      deployments={{ items, deploying: false, deploy: vi.fn() } as never}
      gateView={
        {
          build: { allowed: true, reason: '' },
          staging: { allowed: true, reason: '', repairArea: null },
          stagingHref: '/settings?envTab=targets',
        } as never
      }
      onBuildLatest={vi.fn()}
      onOpenBuildLog={vi.fn()}
      onOpenDeployLog={vi.fn()}
    />,
  );
}

function deployment(status: string) {
  return {
    id: `deployment-${status}`,
    status,
    createdAt: '2026-09-03T00:00:00.000Z',
    startedAt: '2026-09-03T00:00:00.000Z',
    artifactManifestId: 'manifest-1',
  };
}
