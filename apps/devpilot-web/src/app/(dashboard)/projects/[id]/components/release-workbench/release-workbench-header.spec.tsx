// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseWorkbenchHeader } from './release-workbench-header';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button
      {...props}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseWorkbenchHeader', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders the standalone release title after the back action', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseWorkbenchHeader
          detail={{ ...detail, note: 'Candidate release' }}
          onBack={vi.fn()}
        />,
      ),
    );
    const header = container.querySelector('header')!;
    expect(
      header.querySelector('button')!.compareDocumentPosition(container.querySelector('h1')!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(container.querySelector('h1')?.textContent).toBe('releaseBasicVersionTitle:2.4.0');
    expect(header.textContent).not.toContain('releaseContextReleaseOrder');
    expect(header.textContent).not.toContain('Candidate release');
    expect(header.querySelector('button')?.getAttribute('aria-label')).toBe(
      'projectOverviewAction',
    );
    await act(async () => root.unmount());
  });

  it('omits source details and any misleading release-wide status', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseWorkbenchHeader
          detail={{ ...detail, note: '' }}
          onBack={vi.fn()}
        />,
      ),
    );
    const header = container.querySelector('header')!;
    expect(header.textContent).toContain('2.4.0');
    expect(header.textContent).not.toContain('main');
    expect(header.textContent).not.toContain('12345678');
    expect(header.textContent).not.toContain('basicReleaseStatusAwaitingDeploy');
    expect(header.textContent).not.toContain('basicReleaseStatusDeployed');
    expect(header.textContent).not.toContain('releaseWorkbenchCurrentStage');
    expect(container.querySelector('button')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

const detail = {
  id: 'order-full-identifier',
  projectId: 'project-1',
  releaseName: 'Stable candidate',
  releaseVersion: '2.4.0',
  note: 'Candidate release',
  counts: { buildRuns: 1, manifests: 1, releaseRuns: 0 },
  lifecycle: { status: 'staging', phase: 'staging', sourceStatus: 'succeeded' },
  resumeStep: 'staging',
  preflight: { repository: { branch: 'main' } },
} as unknown as ReleaseOrderDetail;
