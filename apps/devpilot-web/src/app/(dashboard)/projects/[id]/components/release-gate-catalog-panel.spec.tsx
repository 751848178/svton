// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
import { ReleaseGateCatalogPanel } from './release-gate-catalog-panel';

const mocks = vi.hoisted(() => ({ useReleaseGateCatalog: vi.fn(), load: vi.fn() }));

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  LoadingState: () => <div data-loading>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  BlockedState: ({ reason }: { reason: ReactNode }) => <div data-blocked>{reason}</div>,
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: ReactNode;
    children: ReactNode;
    footer: ReactNode;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label={String(title)}
      >
        {children}
        {footer}
      </div>
    ) : null,
  StatusTag: ({ status, label }: { status: string; label: ReactNode }) => (
    <span data-status={status}>{label}</span>
  ),
}));
vi.mock('../hooks/use-release-gate-catalog', () => ({
  useReleaseGateCatalog: mocks.useReleaseGateCatalog,
}));

describe('ReleaseGateCatalogPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.useReleaseGateCatalog.mockReturnValue({
      catalog: releaseGateCatalogFixture(),
      loading: false,
      error: null,
      load: mocks.load,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('keeps the complete 51-check catalog behind advanced disclosure when no blocker exists', async () => {
    await renderPanel(root);

    expect(container.textContent).toContain('releaseGateCanEnterBuild');
    expect(container.textContent).toContain('releaseGateCatalogExpand');
    expect(container.textContent).not.toContain('releaseGatePreview.source.title');
    expect(container.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens all 51 checks with 10/11/20/10 phases and complete metadata fields', async () => {
    const catalog = releaseGateCatalogFixture();
    const statuses = [
      'checked',
      'unchecked',
      'blocked',
      'warning',
      'manual',
      'unavailable',
    ] as const;
    const persisted = [
      'passed',
      'pending',
      'failed',
      'warning',
      'needs_human',
      'unavailable',
    ] as const;
    statuses.forEach((status, index) => {
      catalog.checks[index].status = status;
      catalog.checks[index].persistedStatus = persisted[index];
    });
    catalog.summary.statusCounts = {
      checked: 46,
      unchecked: 1,
      blocked: 1,
      warning: 1,
      manual: 1,
      unavailable: 1,
    };
    mocks.useReleaseGateCatalog.mockReturnValue({
      catalog,
      loading: false,
      error: null,
      load: mocks.load,
    });
    await renderPanel(root);

    const opener = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(opener.getAttribute('aria-haspopup')).toBe('dialog');
    await act(async () => opener.click());

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelectorAll('article')).toHaveLength(51);
    expect(dialog.textContent).toContain('releaseGateCheckCount:{"count":10}');
    expect(dialog.textContent).toContain('releaseGateCheckCount:{"count":11}');
    expect(dialog.textContent).toContain('releaseGateCheckCount:{"count":20}');
    const checkStatuses = dialog.querySelectorAll('article [data-status]');
    expect(checkStatuses).toHaveLength(51);
    expect(
      new Set(Array.from(checkStatuses, (node) => node.getAttribute('data-status'))).size,
    ).toBe(6);
    expect(dialog.textContent).toContain('releaseGateProviderLabel');
    expect(dialog.textContent).toContain('releaseGateEvidenceLabel');
    expect(dialog.textContent).toContain('releaseGateCheckedAtLabel');
    expect(dialog.textContent).toContain('releaseGateExpiresAtLabel');
    expect(dialog.textContent).toContain('releaseGateMetadataUnavailable');

    await act(async () => dialog.querySelectorAll('button').item(1).click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () =>
      (container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement).click(),
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('filters the detail dialog when a summary card is clicked and refreshes explicitly', async () => {
    const catalog = releaseGateCatalogFixture();
    catalog.decisions.build.allowed = false;
    catalog.decisions.build.blockerGateIds = ['C01'];
    catalog.checks[0].status = 'blocked';
    catalog.checks[0].persistedStatus = 'failed';
    catalog.summary.statusCounts = {
      ...catalog.summary.statusCounts,
      checked: 50,
      blocked: 1,
    };
    mocks.useReleaseGateCatalog.mockReturnValue({
      catalog,
      loading: false,
      error: null,
      load: mocks.load,
    });
    await renderPanel(root);
    const sourceCard = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('releaseGatePreview.source.title'),
    ) as HTMLButtonElement;
    await act(async () => sourceCard.click());
    expect(container.querySelector('[role="dialog"]')?.querySelectorAll('article')).toHaveLength(3);
    await act(async () => {
      (container.querySelector('button:not([aria-haspopup="dialog"])') as HTMLButtonElement).click();
    });
    expect(mocks.load).toHaveBeenCalled();
  });

  it('retries a failed catalog request without presenting stale facts', async () => {
    mocks.useReleaseGateCatalog.mockReturnValue({
      catalog: null,
      loading: false,
      error: 'failed',
      load: mocks.load,
    });
    await renderPanel(root);
    expect(container.getAttribute('role')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => container.querySelector('button')!.click());
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
});

async function renderPanel(root: Root) {
  await act(async () =>
    root.render(
      <ReleaseGateCatalogPanel
        projectId="project-1"
        releaseOrderId="order-1"
      />,
    ),
  );
}
