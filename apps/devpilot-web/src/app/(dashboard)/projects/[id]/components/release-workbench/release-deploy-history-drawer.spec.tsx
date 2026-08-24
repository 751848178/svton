// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import { ReleaseDeployHistoryDrawer } from './release-deploy-history-drawer';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({
  Drawer: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <aside data-drawer>{children}</aside> : null,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  LinkButton: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  StatusTag: ({ label }: { label?: string }) => <span>{label}</span>,
  EmptyState: ({ title }: { title?: string }) => <div>{title}</div>,
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../release-staging-log-drawer', () => ({ ReleaseStagingLogDrawer: () => null }));

describe('ReleaseDeployHistoryDrawer', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders the operations column inside the table and shortens raw cuids (PX-5/PX-3/ROD-4)', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseDeployHistoryDrawer
          {...props()}
          deployments={deployments() as unknown as ReleaseStagingDeploymentsController}
        />,
      ),
    );
    // 操作列仍是表格最后一列，日志/部署按钮在表格内（视口可见性由真实页面 rect 断言）。
    const headers = container.querySelectorAll('thead th');
    expect(headers.length).toBe(6);
    expect(headers[headers.length - 1].textContent).toBe('releaseBuildColumnActions');
    const lastCell = container.querySelector('tbody tr td:last-child');
    expect(lastCell?.textContent).toContain('viewReleaseStagingLogs');
    expect(lastCell?.textContent).toContain('deployExactManifest');
    // ROD-4/PX-23：行首 cuid 折叠（title 全文），构建列以 #revision 为主。
    const runHeader = container.querySelector('tbody tr th')!;
    expect(runHeader.textContent).toContain('staging-old');
    const artifactCell = container.querySelector('tbody tr td:nth-child(2)')!;
    expect(artifactCell.textContent).toContain('releaseBuildRevision');
    expect(artifactCell.textContent).toContain('build-un…');
    expect(container.textContent).not.toContain('build-unbounded');
    await act(async () => root.unmount());
  });

  it('re-deploys the exact row Manifest without invoking a Build action', async () => {
    const deploy = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseDeployHistoryDrawer
          {...props()}
          deployments={{ ...deployments(), deploy } as unknown as ReleaseStagingDeploymentsController}
        />,
      ),
    );
    const row = container.querySelector('tbody tr')!;
    act(() =>
      row.querySelectorAll('button').forEach((button) => {
        if (button.textContent === 'deployExactManifest') button.click();
      }),
    );
    expect(deploy).toHaveBeenCalledWith('manifest-unbounded');
    await act(async () => root.unmount());
  });

  it('does not POST a staging deployment while the server gate decision is blocked', async () => {
    const deploy = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseDeployHistoryDrawer
          {...props()}
          deployments={{ ...deployments(), deploy } as unknown as ReleaseStagingDeploymentsController}
          deployGate={{ allowed: false, reason: 'required checks unavailable' }}
        />,
      ),
    );
    const row = container.querySelector('tbody tr');
    expect(row?.querySelector('[disabled]')).not.toBeNull();
    act(() =>
      row?.querySelectorAll('button').forEach((button) => {
        if (button.textContent === 'deployExactManifest') button.click();
      }),
    );
    expect(deploy).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'required checks unavailable',
    );
    await act(async () => root.unmount());
  });
});

function props() {
  return {
    open: true,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    builds: {
      items: [build()],
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseBuildsController,
    focusedDeploymentRunId: undefined,
    onOpenLog: vi.fn(),
    onCloseLog: vi.fn(),
    onClose: vi.fn(),
    deployGate: { allowed: true, reason: '' },
  };
}

function deployments() {
  return {
    items: [staging()],
    total: 1,
    loading: false,
    loadedSuccessfully: true,
    deploying: false,
    error: '',
    load: vi.fn(),
    deploy: vi.fn(),
  };
}

function build() {
  return {
    id: 'build-unbounded',
    releaseOrderId: 'order-1',
    revision: 51,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    status: 'succeeded',
    manifest: { id: 'manifest-unbounded', digest: `sha256:${'a'.repeat(64)}`, items: [] },
  };
}

function staging() {
  return {
    id: 'staging-old',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-unbounded',
    status: 'completed',
    dryRun: false,
    startedAt: '2026-08-05T00:00:00Z',
    createdAt: '2026-08-05T00:00:00Z',
  };
}
