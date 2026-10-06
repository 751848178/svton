import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseOrderDetailWorkbench } from './release-order-detail-workbench';

vi.mock('./release-workbench-header', () => ({
  ReleaseWorkbenchHeader: () => <div>basic-header</div>,
}));
vi.mock('./release-input-summary', () => ({
  ReleaseInputSummary: () => <div>basic-input</div>,
}));
vi.mock('./release-basic-flow', () => ({
  ReleaseBasicFlow: () => <div>basic-staging-production</div>,
}));
vi.mock('./release-basic-production-log-drawer', () => ({
  ReleaseBasicProductionLogDrawer: () => <div>basic-production-log</div>,
}));
vi.mock('./release-build-log-layer', () => ({
  ReleaseBuildLogLayer: ({ basic }: { basic?: boolean }) => (
    <div>{basic ? 'basic-build-log' : 'advanced-build-log'}</div>
  ),
}));
vi.mock('./release-staging-log-layer', () => ({
  ReleaseStagingLogLayer: ({ basic }: { basic?: boolean }) => (
    <div>{basic ? 'basic-deploy-log' : 'advanced-deploy-log'}</div>
  ),
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseOrderDetailWorkbench', () => {
  it('composes the MVP staging-to-production flow and direct log surfaces', () => {
    const html = renderToStaticMarkup(
      <ReleaseOrderDetailWorkbench
        projectId="project-1"
        releaseOrderId="order-1"
        detail={{ counts: { releaseRuns: 0 } } as never}
        builds={{ items: [] } as never}
        deployments={{ items: [] } as never}
        productionRuns={[]}
        gateView={{} as never}
        navigation={{} as never}
        onRefresh={vi.fn()}
        onBuildLatest={vi.fn()}
      />,
    );

    expect(html).toContain('basic-header');
    expect(html).toContain('basic-input');
    expect(html).toContain('basic-staging-production');
    expect(html).toContain('basic-build-log');
    expect(html).toContain('basic-deploy-log');
    expect(html).toContain('basic-production-log');
    expect(html).not.toContain('evidence');
    expect(html).not.toContain('history');
  });
});
