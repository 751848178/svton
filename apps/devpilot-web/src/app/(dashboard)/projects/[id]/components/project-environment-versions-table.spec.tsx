// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectEnvironmentVersionsTable } from './project-environment-versions-table';

const mocks = vi.hoisted(() => ({
  error: '',
  load: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={String(href)}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    loading: _loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
  }) => <button {...props}>{children}</button>,
  ErrorBanner: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));
vi.mock('../hooks/use-environment-versions', () => ({
  useEnvironmentVersions: () => ({
    environments: [environment],
    candidates: { staging: [candidate], production: [] },
    loading: false,
    executing: false,
    error: mocks.error,
    load: mocks.load,
    execute: mocks.execute,
  }),
}));
vi.mock('./project-workbench-surface', () => ({
  PROJECT_COMPACT_ACTION_CLASS: 'min-h-11',
  PROJECT_TABLE_CLASS: 'table',
  ProjectTableSurface: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div data-variant={variant}>{children}</div>
  ),
}));

describe('ProjectEnvironmentVersionsTable switch feedback', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    mocks.error = '';
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('keeps a failed action message inside the open switch modal', async () => {
    await act(async () => root.render(<ProjectEnvironmentVersionsTable projectId="project-1" />));
    expect(container.querySelector('[data-variant="embedded"]')).not.toBeNull();
    const trigger = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'switchToVersion',
    );
    await act(async () => trigger!.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    mocks.error = 'version switch failed';
    await act(async () => root.render(<ProjectEnvironmentVersionsTable projectId="project-1" />));
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      'version switch failed',
    );
  });
});

const environment = {
  id: 'environment-1',
  key: 'staging',
  name: 'Staging',
  baselineRole: 'staging',
  currentEnvironmentVersionId: null,
  environmentVersions: [],
};

const candidate = {
  id: 'manifest-1',
  releaseOrder: { releaseVersion: '1.0.0', releaseName: 'Release 1' },
  buildRun: { sourceBranch: 'main', sourceCommitSha: '1234567890', revision: 1 },
  deploymentRuns: [],
};
