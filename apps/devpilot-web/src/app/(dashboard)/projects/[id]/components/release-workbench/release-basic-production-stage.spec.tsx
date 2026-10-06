import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { ReleaseBasicProductionStage } from './release-basic-production-stage';

const mocks = vi.hoisted(() => ({
  production: {
    preview: {
      preflight: { decision: { preApprovalAllowed: true }, concurrency: { state: 'available' } },
      snapshot: {},
    },
    loading: false,
    confirming: false,
    error: '',
    errorKind: null,
    confirm: vi.fn(),
  },
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    loading,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
  }) => (
    <button
      {...props}
      data-variant={variant}
      disabled={props.disabled || loading}
    >
      {children}
    </button>
  ),
}));
vi.mock('../../hooks/use-production-releases', () => ({
  useProductionReleases: () => mocks.production,
}));
vi.mock('../../publish/components/production-confirm-modal', () => ({
  ProductionConfirmModal: ({ basic }: { basic?: boolean }) => (
    <div>{basic ? 'basic-confirm' : 'advanced-confirm'}</div>
  ),
}));
vi.mock('./release-flow-status-tag', () => ({
  FlowStatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseBasicProductionStage', () => {
  it('offers one production deploy action that explicitly reuses staging output', () => {
    const html = renderToStaticMarkup(
      <ReleaseBasicProductionStage
        projectId="project-1"
        releaseOrderId="order-1"
        manifestBuild={{ manifest: { id: 'manifest-1' } } as never}
        stagingDeployment={{ status: 'completed' } as never}
        productionRuns={[]}
        onChanged={vi.fn()}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('releaseBasicProductionAction');
    expect(html).toContain('releaseBasicProductionReuse');
    expect(html).toContain('basic-confirm');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('releaseBasicStep.build.label');
  });

  it('keeps a disabled deployed action beside the low-emphasis log action', () => {
    const html = renderToStaticMarkup(
      <ReleaseBasicProductionStage
        projectId="project-1"
        releaseOrderId="order-1"
        manifestBuild={{ manifest: { id: 'manifest-1' } } as never}
        stagingDeployment={{ status: 'completed' } as never}
        productionRuns={[productionRun()]}
        onChanged={vi.fn()}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('releaseExecutionStatusSucceeded');
    expect(html).toContain('viewProductionLogs');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('releaseBasicDeployedAction');
    expect(html).toContain('releaseBasicProductionCompleted');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('releaseProductionViewHistory');
  });

  it('keeps the production action disabled and loading while the run is active', () => {
    const html = renderToStaticMarkup(
      <ReleaseBasicProductionStage
        projectId="project-1"
        releaseOrderId="order-1"
        manifestBuild={{ manifest: { id: 'manifest-1' } } as never}
        stagingDeployment={{ status: 'completed' } as never}
        productionRuns={[productionRun('running')]}
        onChanged={vi.fn()}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('releaseBasicDeployingAction');
    expect(html).toContain('releaseBasicProductionRunning');
    expect(html).toContain('disabled=""');
  });
});

function productionRun(status = 'succeeded') {
  return {
    id: 'production-1',
    status,
    startedAt: '2026-09-03T00:00:00.000Z',
    finishedAt: '2026-09-03T00:01:00.000Z',
    createdAt: '2026-09-03T00:00:00.000Z',
    deploymentRuns: [],
    errorCode: null,
    errorMessage: null,
  } as unknown as ReleaseEvidenceProductionRun;
}
