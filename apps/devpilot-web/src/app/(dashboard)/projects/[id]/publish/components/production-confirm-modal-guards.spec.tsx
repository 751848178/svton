// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { ProductionConfirmModal } from './production-confirm-modal';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    disabled,
    loading: _loading,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  ),
  Modal: ({ open, children, footer }: { open: boolean; children: ReactNode; footer: ReactNode }) =>
    open ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
}));

describe('ProductionConfirmModal server guards', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each([
    [false, 'available', 'productionConfirmPreflightBlocked'],
    [true, 'occupied', 'productionConfirmConcurrencyOccupied'],
  ] as const)(
    'keeps confirmation disabled for real server guard state',
    async (allowed, state, key) => {
      const container = document.createElement('div');
      const root = createRoot(container);
      await act(async () =>
        root.render(
          <ProductionConfirmModal
            open
            loading={false}
            confirming={false}
            error=""
            preview={preview(allowed, state)}
            onClose={vi.fn()}
            onConfirm={vi.fn()}
          />,
        ),
      );
      expect(
        container.querySelector('[data-testid="production-confirm-blocked-reason"]')?.textContent,
      ).toContain(key);
      const button = [...container.querySelectorAll('button')].find((item) =>
        item.textContent?.includes('productionConfirmAction'),
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      await act(async () => root.unmount());
    },
  );
});

function preview(allowed: boolean, state: 'available' | 'occupied') {
  return {
    inputHash: 'input',
    snapshot: {
      projectId: 'project',
      releaseOrder: { id: 'order', releaseVersion: '1.0.0' },
      environment: { id: 'env', key: 'production', name: 'Production' },
      build: { id: 'build', revision: 1, sourceBranch: 'main', sourceCommitSha: 'commit' },
      manifest: { id: 'manifest', digest: 'sha256:digest' },
      stagingProof: { deploymentRunId: 'staging', finishedAt: '2026-08-28T00:00:00Z' },
      config: { revisionId: 'revision', revision: 1, routeSnapshot: {} },
      releasePolicy: { requireProductionApproval: true },
      workload: { services: [] },
    },
    preflight: {
      decision: { preApprovalAllowed: allowed },
      checks: [],
      concurrency: { limit: 1, state, checkedAt: '2026-08-28T00:00:00Z', activeRun: null },
    },
  } as unknown as ProductionReleasePreview;
}
