// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionCandidates,
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../types/environment-version.types';
import { EnvironmentRecoveryDialog } from './environment-recovery-dialog';
import { EnvironmentVersionsPanel } from './environment-versions-panel';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  load: vi.fn(),
  push: vi.fn(),
  versions: {
    environments: [] as EnvironmentVersionEnvironment[],
    candidates: { staging: [], production: [] } as EnvironmentVersionCandidates,
    loading: false,
    error: '',
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => unknown;
  }) => (
    <button
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  ErrorBanner: ({
    message,
    onRetry,
    retryLabel,
  }: {
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
  }) => (
    <div role="alert">
      {message}
      {onRetry ? <button onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  ),
}));
vi.mock('../hooks/use-environment-versions', () => ({
  useEnvironmentVersions: () => ({
    environments: mocks.versions.environments,
    candidates: mocks.versions.candidates,
    loading: mocks.versions.loading,
    executing: false,
    error: mocks.versions.error,
    load: mocks.load,
    execute: mocks.execute,
  }),
}));
vi.mock('@svton/ui', () => ({
  LoadingState: ({ text }: { text?: React.ReactNode }) => <div role="status">{text}</div>,
  EmptyState: ({
    text,
    description,
    action,
  }: {
    text?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div>
      {text}
      {description}
      {action}
    </div>
  ),
  Dialog: ({
    children,
    title,
    confirmText,
    confirmDisabled,
    onConfirm,
  }: {
    children: React.ReactNode;
    title?: string;
    confirmText?: string;
    confirmDisabled?: boolean;
    onConfirm?: () => void;
  }) => (
    <div data-dialog-title={title}>
      {children}
      {confirmText ? (
        <button
          data-testid="dialog-confirm"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmText}
        </button>
      ) : null}
    </div>
  ),
}));

describe('EnvironmentVersionsPanel Demo-aligned read model', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.execute.mockReset();
    mocks.load.mockReset();
    mocks.push.mockReset();
    mocks.versions.environments = environments();
    mocks.versions.candidates = candidates();
    mocks.versions.loading = false;
    mocks.versions.error = '';
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders the page head with the environment count badge', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('environmentVersionPageTitle');
    expect(html).toContain('environmentVersionsDescription');
    expect(html).toContain('&quot;count&quot;:2');
  });

  it('renders a distinct loading state without a zero count or empty table', () => {
    mocks.versions.environments = [];
    mocks.versions.loading = true;
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('environmentVersionsLoading');
    expect(html).not.toContain('environmentVersionEnvironmentCount');
    expect(html).not.toContain('environmentVersionChangeLog');
  });

  it('renders an actionable empty state without the environment table', () => {
    mocks.versions.environments = [];
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('environmentVersionsEmptyTitle');
    expect(html).toContain('environmentVersionsEmptyDescription');
    expect(html).toContain('manageEnvironmentConfiguration');
    expect(html).not.toContain('environmentVersionEnvironmentCount');
    expect(html).not.toContain('environmentVersionChangeLog');
  });

  it('renders a retryable error state without stale success content', async () => {
    mocks.versions.environments = [];
    mocks.versions.error = 'request failed';
    await renderPanel();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('request failed');
    expect(container.textContent).not.toContain('environmentVersionChangeLog');
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'environmentVersionsRetry')!
        .click();
    });
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('renders per-environment cards with the four facts and rollback/upgrade actions', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html.match(/environmentVersionDeployedBadge/g)).toHaveLength(2);
    expect(html).toContain('environmentVersionDeployedVersion');
    expect(html).toContain('environmentVersionSourceReleaseOrder');
    expect(html).toContain('environmentVersionArtifactManifest');
    expect(html).toContain('environmentVersionLatestDeployedAt');
    expect(html.match(/environmentVersionRollback/g)).toHaveLength(2);
    expect(html).toContain('environmentVersionUpgradeShort');
    expect(html).toContain('environmentVersionBuildRun');
    expect(html).toContain('&quot;revision&quot;:7');
    expect(html).toContain('environmentVersionCandidateOption');
    expect(html).toContain('environmentVersionProductionCallout');
  });

  it('renders the environment change log table with all six columns and the previous-version chain', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('environmentVersionChangeLog');
    expect(html).toContain('environmentVersionChangeLogHelper');
    expect(html).toContain('environmentVersionChangeLogCaption');
    expect(html).toContain('environmentVersionColumnEnvironment');
    expect(html).toContain('environmentVersionColumnAction');
    expect(html).toContain('environmentVersionColumnVersionChange');
    expect(html).toContain('environmentVersionColumnArtifact');
    expect(html).toContain('environmentVersionColumnResult');
    expect(html).toContain('environmentVersionColumnTime');
    expect(html).toContain('2.4.0 → 2.4.1');
    expect(html).toContain('environmentVersionKindUpgrade');
    expect(html).toContain('environmentVersionKindRecovery');
    expect(html).toContain('environmentVersionResultSuccess');
    expect(html).toContain('environmentVersionResultHistory');
    expect(html).toContain(
      'data-environment-role="staging" data-version-kind="upgrade" data-version-id="version-staging-current" data-version-current="true"',
    );
    expect(html).toContain(
      'data-environment-role="production" data-version-kind="recovery" data-version-id="version-production-history" data-version-current="false"',
    );
  });

  it('shows the source release order with id and release version in the card facts', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('order-1');
    expect(html).toContain('environmentVersionCurrentValue');
  });

  it('renders the Production rollback dialog copy when opened', () => {
    const environment = environments().find((item) => item.baselineRole === 'production')!;
    const html = renderToStaticMarkup(
      <EnvironmentRecoveryDialog
        projectId="project-1"
        environment={environment}
        defaultSourceVersionId="version-production-history"
        onClose={() => undefined}
        onConfirmed={() => undefined}
      />,
    );

    expect(html).toContain('environmentVersionRecoveryDialogTitle');
    expect(html).toContain('environmentVersionRecoveryDialogCallout');
    expect(html).toContain('environmentVersionRecoveryTarget');
    expect(html).toContain('environmentVersionRecoveryCreateAction');
    expect(html).toContain('environmentVersionCurrent');
  });

  it('renders per-environment candidate lists in the upgrade selects', async () => {
    await renderPanel();
    const [stagingSelect, productionSelect] = [...container.querySelectorAll('select')];
    expect([...stagingSelect.options].map((option) => option.value)).toEqual([
      'manifest-1',
      'manifest-2',
    ]);
    expect([...productionSelect.options].map((option) => option.value)).toEqual(['manifest-1']);
  });

  it('carries the staging-proof suffix only on Production candidate options', async () => {
    await renderPanel();
    const [stagingSelect, productionSelect] = [...container.querySelectorAll('select')];
    expect(
      [...stagingSelect.options].every(
        (option) => !option.textContent.includes('environmentVersionCandidateProductionSuffix'),
      ),
    ).toBe(true);
    expect(productionSelect.options[0].textContent).toContain(
      'environmentVersionCandidateProductionSuffix',
    );
  });

  it('renders the disabled empty-candidates placeholder without free-text input', async () => {
    mocks.versions.candidates = { staging: [], production: [] };
    await renderPanel();
    const selects = [...container.querySelectorAll('select')];
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect((select as HTMLSelectElement).disabled).toBe(true);
      expect([...select.options].map((option) => option.textContent)).toEqual([
        'environmentVersionNoCandidates',
      ]);
    }
    expect(container.querySelectorAll('input').length).toBe(0);
    expect(mocks.versions.candidates.staging.length).toBe(0);
  });

  it('opens the recovery dialog for Staging rollback and executes the recovery directly', async () => {
    await renderPanel();
    const stagingCard = container.querySelectorAll('article')[0];
    const rollback = [...stagingCard.querySelectorAll('button')].find(
      (button) => button.textContent === 'environmentVersionRollback',
    )!;
    await act(async () => {
      rollback.click();
    });
    expect(
      container.querySelector('[data-dialog-title="environmentVersionRecoveryDialogTitle"]'),
    ).not.toBeNull();
    const confirm = container.querySelector('[data-testid="dialog-confirm"]') as HTMLButtonElement;
    await act(async () => {
      confirm.click();
    });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith('environment-staging', {
      kind: 'recovery',
      sourceVersionId: 'version-staging-history',
    });
  });

  it('opens the recovery dialog for Production rollback', async () => {
    await renderPanel();
    const productionCard = container.querySelectorAll('article')[1];
    const rollback = [...productionCard.querySelectorAll('button')].find(
      (button) => button.textContent === 'environmentVersionRollback',
    )!;
    await act(async () => {
      rollback.click();
    });
    expect(
      container.querySelector('[data-dialog-title="environmentVersionRecoveryDialogTitle"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('environmentVersionRecoveryDefaultRecommend');
  });

  async function renderPanel() {
    await act(async () => root.render(<EnvironmentVersionsPanel projectId="project-1" />));
  }
});

function environments(): EnvironmentVersionEnvironment[] {
  return (['staging', 'production'] as const).map((role) => {
    const history = version(`version-${role}-history`, 'manifest-2', 'recovery', {
      releaseOrder: { id: 'order-1', releaseVersion: '2.4.0' },
      deploymentRun: {
        ...version(`version-${role}-history`, 'manifest-2', 'recovery').deploymentRun,
        createdAt: '2026-08-04T00:00:00Z',
        finishedAt: '2026-08-04T00:01:00Z',
      },
    });
    const base = version(`version-${role}-current`, 'manifest-1', 'upgrade');
    const current: EnvironmentVersionItem = {
      ...base,
      previousVersionId: history.id,
      releaseOrder: { id: 'order-1', releaseVersion: '2.4.1' },
      effectiveAt: '2026-08-05T01:00:00Z',
      deploymentRun: { ...base.deploymentRun, finishedAt: '2026-08-05T01:02:00Z' },
    };
    return {
      id: `environment-${role}`,
      key: role,
      name: role,
      baselineRole: role,
      currentEnvironmentVersionId: current.id,
      environmentVersions: [current, history],
    };
  });
}

function version(
  id: string,
  manifestId: string,
  kind: EnvironmentVersionItem['kind'],
  overrides?: Partial<EnvironmentVersionItem>,
): EnvironmentVersionItem {
  return {
    id,
    environmentId: 'environment-1',
    artifactManifestId: manifestId,
    previousVersionId: null,
    kind,
    effectiveAt: '2026-08-05T00:00:00Z',
    releaseOrder: { id: 'order-1', releaseVersion: '2.4.0' },
    artifactManifest: {
      id: manifestId,
      digest: `sha256:${manifestId}`,
      buildRun: { id: 'build-1', revision: 7, sourceCommitSha: 'a'.repeat(40) },
    },
    deploymentRun: {
      id: 'deployment-1',
      status: 'completed',
      createdAt: '2026-08-05T00:00:00Z',
      finishedAt: '2026-08-05T00:01:00Z',
    },
    ...overrides,
  };
}

function candidates(): EnvironmentVersionCandidates {
  return {
    staging: [candidate('manifest-1', 1), candidate('manifest-2', 2)],
    production: [candidate('manifest-1', 1)],
  };
}

function candidate(id: string, revision: number): EnvironmentVersionCandidate {
  return {
    id,
    digest: `sha256:${id}`,
    releaseOrder: { id: `order-${revision}`, releaseVersion: `2.4.${revision}` },
    buildRun: { id: `build-${revision}`, revision, sourceCommitSha: 'a'.repeat(40) },
    deploymentRuns: [{ id: `deployment-${revision}` }],
    releaseRuns: [
      {
        id: `release-${revision}`,
        operationApproval: { id: `approval-${revision}`, status: 'approved', consumedAt: null },
      },
    ],
  };
}
