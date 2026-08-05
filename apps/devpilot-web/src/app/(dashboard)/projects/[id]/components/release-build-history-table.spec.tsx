// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { ReleaseBuildHistoryTable } from './release-build-history-table';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  StatusTag: ({ label, status }: { label: string; status: string }) => (
    <span data-tone={status}>{label}</span>
  ),
}));

describe('ReleaseBuildHistoryTable', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders dense per-run evidence and keeps log actions bound to exact IDs', async () => {
    const onOpenLog = vi.fn();
    await act(async () => {
      root.render(
        <ReleaseBuildHistoryTable
          items={[
            build({
              id: 'build-success',
              status: 'succeeded',
              startedAt: '2026-08-06T00:00:00.000Z',
              finishedAt: '2026-08-06T00:01:05.000Z',
              manifest: { id: 'manifest-1', digest: 'sha256:digest-1', items: [] },
            }),
            build({ id: 'build-canceled', revision: 2, status: 'canceled' }),
          ]}
          onOpenLog={onOpenLog}
        />,
      );
    });

    expect(container.querySelectorAll('thead th')).toHaveLength(6);
    expect(container.textContent).toContain('build-success');
    expect(container.textContent).toContain('manifest-1');
    expect(container.textContent).toContain('sha256:digest-1');
    expect(container.textContent).toContain('1m 5s');
    expect(container.querySelector('[data-tone="success"]')).not.toBeNull();
    expect(container.querySelector('[data-tone="idle"]')).not.toBeNull();
    const buttons = container.querySelectorAll('button');
    act(() => buttons[0]?.click());
    act(() => buttons[1]?.click());
    expect(onOpenLog.mock.calls).toEqual([['build-success'], ['build-canceled']]);
  });
});

function build(overrides: Partial<ReleaseBuildItem>): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'running',
    logReference: 'build-log://build-1',
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-06T00:00:00.000Z',
    manifest: null,
    ...overrides,
  };
}
