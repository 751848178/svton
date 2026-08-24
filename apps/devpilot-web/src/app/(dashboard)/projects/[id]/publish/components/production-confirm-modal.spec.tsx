// @vitest-environment jsdom

/**
 * PX-8 回归：生产确认弹窗。
 * - 有 snapshot：差异摘要四行完整渲染，确认钮可点。
 * - 无 snapshot（加载失败/无预览）：中性空态说明 + 确认钮禁用且带常驻原因文案。
 */
import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductionConfirmModal } from './production-confirm-modal';
import type { ProductionReleasePreview } from '../../types/release-production.types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    disabled,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} {...rest}>
      {children}
    </button>
  ),
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
  }) => (open ? <div role="dialog" aria-label={String(title)}>{children}{footer}</div> : null),
}));

describe('ProductionConfirmModal (PX-8)', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders the full diff summary and an enabled confirm button when a snapshot exists', async () => {
    const onConfirm = vi.fn(async () => ({}));
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ProductionConfirmModal
          open
          loading={false}
          confirming={false}
          error=""
          preview={preview()}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      ),
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('productionEnvironment');
    expect(dialog.textContent).toContain('productionVersion');
    expect(dialog.textContent).toContain('productionArtifact');
    expect(dialog.textContent).toContain('productionBuildSource');
    expect(dialog.textContent).toContain('sha256:aaaa');
    expect(container.querySelector('[data-testid="production-confirm-empty-state"]')).toBeNull();
    const confirmButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('productionConfirmAction'),
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    await act(async () => confirmButton.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('shows a neutral empty state and a disabled confirm button with a visible reason when no snapshot exists', async () => {
    const onConfirm = vi.fn(async () => ({}));
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ProductionConfirmModal
          open
          loading={false}
          confirming={false}
          error=""
          loadError="preview request failed"
          preview={null}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      ),
    );
    const emptyState = container.querySelector('[data-testid="production-confirm-empty-state"]');
    expect(emptyState?.textContent).toContain('productionConfirmSnapshotUnavailable');
    expect(emptyState?.textContent).toContain('preview request failed');
    const reason = container.querySelector('[data-testid="production-confirm-blocked-reason"]');
    expect(reason?.textContent).toContain('productionConfirmDisabledPrefix');
    const confirmButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('productionConfirmAction'),
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.getAttribute('aria-describedby')).toBe('step0-production-confirm-blocked');
    act(() => confirmButton.click());
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

function preview(): ProductionReleasePreview {
  return {
    inputHash: 'input-1',
    snapshot: {
      version: 2,
      projectId: 'project-1',
      releaseOrder: { id: 'order-1', releaseVersion: '0.0.1' },
      environment: { id: 'env-1', key: 'production', name: 'Production', baselineRole: 'production' },
      build: { id: 'build-1', revision: 10, sourceBranch: 'master', sourceCommitSha: '8e7c465d56e6' },
      manifest: { id: 'manifest-1', digest: `sha256:${'a'.repeat(64)}` },
      stagingProof: { deploymentRunId: 'deploy-1', environmentId: 'env-0', finishedAt: '2026-08-10T19:37:27.000Z' },
      config: {
        revisionId: 'rev-1',
        revision: 1,
        snapshotHash: 'hash-1',
        resourceSnapshot: {},
        routeSnapshot: {},
        policySnapshot: {},
        observabilitySnapshot: {},
      },
      releasePolicy: {
        revisionId: 'rev-1',
        revision: 1,
        strategy: 'standard',
        requireProductionApproval: true,
        snapshotHash: 'hash-1',
        synthetic: false,
      },
      workload: { inputHash: 'workload-1', services: [] },
    },
    preflight: {
      decision: { preApprovalAllowed: true },
    } as unknown as ProductionReleasePreview['preflight'],
  } as unknown as ProductionReleasePreview;
}
