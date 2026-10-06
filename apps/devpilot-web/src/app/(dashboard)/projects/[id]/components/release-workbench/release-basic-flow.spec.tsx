import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseBasicFlow } from './release-basic-flow';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./release-basic-rail', () => ({ BasicReleaseRail: () => <nav>major-stages</nav> }));
vi.mock('./release-basic-substeps', () => ({
  ReleaseBasicSubsteps: ({ steps }: { steps: unknown[] }) => (
    <nav data-testid="basic-substeps">{steps.length}</nav>
  ),
}));
vi.mock('./release-basic-staging-stage', () => ({
  ReleaseBasicStagingStage: () => <div>staging-content</div>,
}));
vi.mock('./release-basic-production-stage', () => ({
  ReleaseBasicProductionStage: () => <div>production-content</div>,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseBasicFlow', () => {
  it('keeps substep navigation for the two-step staging stage', () => {
    const html = renderFlow('staging');
    expect(html).toContain('data-testid="basic-substeps"');
    expect(html).toContain('>2</nav>');
    expect(html).toContain('basic-release-step-panel-stagingDeploy');
    expect(html).toContain('staging-content');
  });

  it('renders production content directly when the stage has one step', () => {
    const html = renderFlow('production');
    expect(html).toContain('production-content');
    expect(html).not.toContain('data-testid="basic-substeps"');
    expect(html).not.toContain('basic-release-step-panel-productionDeploy');
    expect(html).not.toContain('basic-release-step-tab-productionDeploy');
  });
});

function renderFlow(release: 'staging' | 'production') {
  const build = {
    id: 'build-1',
    revision: 1,
    status: 'succeeded',
    createdAt: '2026-09-03T00:00:00.000Z',
    manifest: { id: 'manifest-1' },
  };
  const deployment = {
    id: 'deployment-1',
    status: 'completed',
    dryRun: false,
    artifactManifestId: 'manifest-1',
    createdAt: '2026-09-03T00:01:00.000Z',
    startedAt: '2026-09-03T00:01:00.000Z',
  };
  return renderToStaticMarkup(
    <ReleaseBasicFlow
      projectId="project-1"
      releaseOrderId="order-1"
      detail={{ counts: { releaseRuns: 0 } } as never}
      builds={{ items: [build], building: false } as never}
      deployments={{ items: [deployment], deploying: false } as never}
      productionRuns={[]}
      gateView={{} as never}
      navigation={
        {
          release,
          step: 'staging',
          selectRelease: vi.fn(),
          selectStep: vi.fn(),
          openBuildLog: vi.fn(),
          openDeployLog: vi.fn(),
          openProductionLog: vi.fn(),
        } as never
      }
      onBuildLatest={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
}
