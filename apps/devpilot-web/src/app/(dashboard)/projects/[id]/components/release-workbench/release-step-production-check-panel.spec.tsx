// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { productionCheckBuild, productionCheckPreview } from './release-production-check.fixture';
import { ReleaseStepProductionCheckPanel } from './release-step-production-check-panel';

const mocks = vi.hoisted(() => ({
  controller: null as ReturnType<typeof controller> | null,
  hookArgs: [] as unknown[][],
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@svton/ui', () => ({
  LoadingState: ({ text }: { text: string }) => <p>{text}</p>,
  Tabs: ({
    items,
  }: {
    items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }>;
  }) => (
    <div>
      {items.map((item) => (
        <section key={item.key}>
          {item.label}
          {item.children}
        </section>
      ))}
    </div>
  ),
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  ErrorBanner: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div role="alert">
      {message}
      <button onClick={onRetry}>retry</button>
    </div>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../../hooks/use-production-releases', () => ({
  useProductionReleases: (...args: unknown[]) => {
    mocks.hookArgs.push(args);
    return mocks.controller;
  },
}));

describe('ReleaseStepProductionCheckPanel', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.hookArgs = [];
    mocks.controller = controller(productionCheckPreview());
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders exact preview facts, guards and checks and refreshes through the controller', async () => {
    await render();
    const text = container.textContent || '';
    expect(text).toContain('Production · production');
    expect(text).toContain('api.example.com');
    expect(text).toContain('component-api');
    expect(text).toContain('D01');
    expect(text).toContain('releaseProductionCheckApprovalNotCreated');
    expect(text).toContain('releaseProductionCheckConcurrencyState.occupied');
    expect(text).toContain('releaseProductionCheckAllChecksTab');
    expect(text).toContain('releaseRunTechnicalDetails');
    expect(mocks.hookArgs.at(-1)?.at(-1)).toBe(true);
    const refresh = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('releaseGateRefresh'),
    );
    act(() => refresh?.click());
    expect(mocks.controller?.refreshPreflight).toHaveBeenCalledOnce();
  });

  it('fails closed on a preview load error', async () => {
    mocks.controller = controller(null, 'Production 没有可启动的活动服务');
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Production 没有可启动的活动服务',
    );
    expect(container.querySelector('[data-testid="production-check-panel"]')).toBeNull();
  });

  it('only offers repair actions for checks that need attention', async () => {
    const preview = productionCheckPreview();
    preview.preflight.checks.push({
      ...preview.preflight.checks[0],
      id: 'D02',
      status: 'checked',
      repairHref: '/repair-passed-check',
    });
    mocks.controller = controller(preview);
    await render();
    expect(container.querySelector('a[href="/repair"]')).not.toBeNull();
    expect(container.querySelector('a[href="/repair-passed-check"]')).toBeNull();
  });

  async function render() {
    await act(async () =>
      root.render(
        <ReleaseStepProductionCheckPanel
          projectId="project-1"
          releaseOrderId="order-1"
          stagingProof={{
            id: 'staging-1',
            status: 'completed',
            artifactManifestId: 'manifest-1',
            dryRun: false,
            result: {
              workloadReady: { status: 'passed' },
              healthProbe: { status: 'passed' },
              httpProbe: { status: 'not_configured' },
            },
          }}
          manifestBuild={productionCheckBuild()}
          productionRun={null}
          onChanged={vi.fn()}
        />,
      ),
    );
  }
});

function controller(value: ProductionReleasePreview | null, error = '') {
  return {
    preview: value,
    loading: false,
    confirming: false,
    refreshing: false,
    error,
    errorKind: error ? ('load' as const) : null,
    load: vi.fn(),
    confirm: vi.fn(),
    refreshPreflight: vi.fn(),
  };
}
