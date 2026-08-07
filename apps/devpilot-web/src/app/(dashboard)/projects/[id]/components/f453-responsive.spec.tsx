// @vitest-environment jsdom

/**
 * F453 responsive — focused specs for AC-UI-019..025.
 *
 * jsdom cannot compute real layout (scrollWidth/clientWidth), so the unit-level
 * checks pin the responsive CONTRACT: truncation utilities + full-value access
 * (title) on long values, Drawer/Dialog width + internal scroll bounds, and the
 * structural responsive patterns (lg: grids, overflow-x-auto table wrappers,
 * stepper max-[820px]:flex-col). Real scrollWidth==clientWidth evidence at
 * 1484x1324 / 1280x800 / 390x844 is captured by the F453 browser runner
 * (f453-browser-evidence.json).
 */

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer, Modal } from '@svton/ui';
import { ReleaseOrderListRow } from './release-order-list-row';
import { ReleaseOrderStagingStep } from './release-order-staging-step';
import { ProjectDirectoryPanel } from '../../components/project-directory-panel';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import type { ReleaseBuildItem } from '../types/release-order.types';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => unknown;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  BlockedState: () => <div data-blocked />,
  EmptyState: () => <div data-empty />,
  ErrorBanner: () => <div data-error />,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

const mocks = vi.hoisted(() => ({
  builds: {} as Record<string, unknown>,
  staging: {} as Record<string, unknown>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../hooks/use-release-builds', () => ({ useReleaseBuilds: () => mocks.builds }));
vi.mock('../hooks/use-release-staging-deployments', () => ({
  useReleaseStagingDeployments: () => mocks.staging,
}));
vi.mock('./release-staging-evidence-list', () => ({
  ReleaseStagingEvidenceList: () => null,
}));
vi.mock('./release-staging-log-drawer', () => ({
  ReleaseStagingLogDrawer: () => null,
}));

describe('F453 long-value truncation + full-value access (AC-UI-022)', () => {
  it('release list row: last-execution and deployment lines truncate and keep full value in title', () => {
    const item = listItem({
      environmentName: 'staging-region-east-1-very-long-environment-name-for-overflow',
    });
    const html = renderToMarkup(<ReleaseOrderListRow item={item} onOpen={() => {}} />);
    const lines = html.match(
      /<p[^>]*class="mt-1 truncate text-xs text-muted-foreground"[^>]*title="([^"]*)"[^>]*>/g,
    );
    expect(lines).not.toBeNull();
    const titles = lines!.map((m) => m.match(/title="([^"]*)"/)![1]).join('\n');
    expect(titles).toContain('releaseExecutionStatusAwaitingApproval');
    expect(titles).toContain('releaseExecutionStatusCompleted');
    expect(titles).toContain('staging-region-east-1-very-long-environment-name-for-overflow');
    expect(titles).toContain('releaseEnvironmentStaging');
  });

  it('staging step: manifest select options use short IDs while the select keeps the full value in title', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    mocks.builds = {
      items: [
        build({
          id: 'build-run-very-long-id-abcdefghijklmnop',
          manifestId: 'manifest-very-long-id-abcdefghijklmnop',
        }),
      ],
      loading: false,
      error: '',
      load: vi.fn(),
    };
    mocks.staging = {
      items: [],
      total: 0,
      loading: false,
      loadedSuccessfully: true,
      deploying: false,
      error: '',
      load: vi.fn(),
      deploy: vi.fn(),
    };
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <ReleaseOrderStagingStep
          projectId="project-1"
          releaseOrderId="order-1"
          onChanged={vi.fn()}
          focusedDeploymentRunId={undefined}
          onOpenLog={vi.fn()}
          onCloseLog={vi.fn()}
        />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const select = host.querySelector<HTMLSelectElement>('select');
    expect(select).not.toBeNull();
    const option = select!.querySelector('option[value]');
    expect(option).not.toBeNull();
    expect(option!.textContent).not.toContain('build-run-very-long-id-abcdefghijklmnop');
    expect(option!.textContent).not.toContain('manifest-very-long-id-abcdefghijklmnop');
    expect(option!.textContent).toContain('…');
    expect(select!.getAttribute('title')).toContain('build-run-very-long-id-abcdefghijklmnop');
    expect(select!.getAttribute('title')).toContain('manifest-very-long-id-abcdefghijklmnop');
  });
});

describe('F453 Drawer/Dialog width + scroll bounds (AC-UI-023)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('Modal caps width to the viewport and keeps content scrollable inside', async () => {
    await act(async () => {
      root.render(
        <Modal
          open
          onClose={vi.fn()}
          title="Dialog"
          width={760}
        >
          <p>content</p>
        </Modal>,
      );
    });
    const panel = document.querySelector<HTMLDivElement>('[role="dialog"] > div');
    expect(panel).not.toBeNull();
    expect(panel!.className).toContain('max-w-[calc(100vw-32px)]');
    expect(panel!.className).toContain('max-h-[calc(100vh-64px)]');
    const body = panel!.querySelector<HTMLDivElement>('div.flex-1');
    expect(body).not.toBeNull();
    expect(body!.className).toContain('overflow-auto');
  });

  it('Drawer caps width to min(760px, 100vw) and keeps content scrollable inside', async () => {
    await act(async () => {
      root.render(
        <Drawer
          open
          onClose={vi.fn()}
          title="Logs"
          width="min(760px, 100vw)"
        >
          <p>content</p>
        </Drawer>,
      );
    });
    const panel = document.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel!.style.width).toBe('min(760px, 100vw)');
    const body = panel!.querySelector<HTMLDivElement>('div.flex-1');
    expect(body).not.toBeNull();
    expect(body!.className).toContain('overflow-auto');
  });
});

describe('F453 responsive structural patterns (AC-UI-019..021)', () => {
  it('directory panel only renders the five-column head at lg, rows stack below', () => {
    const html = renderToMarkup(
      <ProjectDirectoryPanel
        items={[]}
        validating={false}
      />,
    );
    expect(html).toContain('hidden grid-cols-[minmax(0,1.45fr)');
    expect(html).toContain('lg:grid');
  });

  it('detail shell stepper stacks the tabs below 820px with full-width tabs', () => {
    const { html } = stepperMarkup();
    expect(html).toContain('max-[820px]:flex-col');
    expect(html).toContain('max-[820px]:w-full');
    expect(html).toContain('max-[820px]:self-center');
    expect(html).toContain('max-[820px]:rotate-90');
  });

  it('build/staging/production tables scroll inside overflow-x-auto wrappers, not the page', () => {
    const wrappers = [
      'src/app/(dashboard)/projects/[id]/components/release-build-history-table.tsx',
      'src/app/(dashboard)/projects/[id]/components/release-staging-evidence-list.tsx',
      'src/app/(dashboard)/projects/[id]/components/release-production-evidence-list.tsx',
      'src/app/(dashboard)/projects/create/components/finalize-baseline-step.tsx',
    ];
    for (const file of wrappers) {
      const source = readSource(file);
      expect(source).toMatch(/<div className="overflow-x-auto[^"]*">/);
      expect(source).toMatch(/min-w-\[\d+px\]/);
    }
  });
});

function renderToMarkup(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

function readSource(file: string) {
  const fs = require('node:fs');
  return fs.readFileSync(file, 'utf8');
}

function stepperMarkup() {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    'src/app/(dashboard)/projects/[id]/components/release-order-stepper.tsx',
    'utf8',
  );
  return { html: source };
}

function listItem(overrides: Partial<ReleaseOrderListItem['deployment']['latest']> = {}): ReleaseOrderListItem {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: '',
    persistedStatus: 'active',
    lifecycle: {
      status: 'awaiting_approval',
      phase: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      sourceStatus: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    createdAt: '2026-08-04T01:00:00.000Z',
    source: {
      branch: 'main',
      commitSha: 'c'.repeat(40),
      buildRunId: 'build-3',
      buildRevision: 3,
      buildStatus: 'succeeded',
    },
    build: {
      count: 3,
      recentSuccessfulManifest: {
        id: 'manifest-success-2',
        digest: `sha256:${'b'.repeat(64)}`,
        buildRunId: 'build-2',
        buildRevision: 2,
        createdAt: '2026-08-04T05:00:00.000Z',
      },
    },
    deployment: {
      count: 2,
      latest: {
        id: 'deployment-2',
        environmentId: 'staging',
        environmentRole: 'staging',
        environmentName: 'Staging',
        status: 'completed',
        artifactManifestId: 'manifest-success-2',
        buildRunId: 'build-2',
        occurredAt: '2026-08-04T06:00:00.000Z',
        ...overrides,
      },
    },
    lastExecution: {
      step: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      status: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    lastExecutedAt: '2026-08-04T08:00:00.000Z',
  } as unknown as ReleaseOrderListItem;
}

function build(overrides: Partial<ReleaseBuildItem> & { manifestId: string }): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 51,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'succeeded',
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-08-04T00:00:00.000Z',
    finishedAt: '2026-08-04T00:01:00.000Z',
    createdAt: '2026-08-04T00:00:00.000Z',
    manifest: { id: overrides.manifestId, digest: `sha256:${'a'.repeat(64)}` },
    ...overrides,
  } as ReleaseBuildItem;
}
