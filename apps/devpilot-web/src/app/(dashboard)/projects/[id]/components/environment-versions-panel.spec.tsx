import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../types/environment-version.types';
import { EnvironmentRecoveryDialog } from './environment-recovery-dialog';
import { EnvironmentVersionsPanel } from './environment-versions-panel';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), push: vi.fn() }));
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
}));
vi.mock('../hooks/use-environment-versions', () => ({
  useEnvironmentVersions: () => ({
    environments: environments(),
    candidates: candidates(),
    executing: false,
    error: '',
    execute: mocks.execute,
  }),
}));
vi.mock('@svton/ui', () => ({
  Dialog: ({
    children,
    title,
    confirmText,
  }: {
    children: React.ReactNode;
    title?: string;
    confirmText?: string;
  }) => (
    <div data-dialog-title={title}>
      {children}
      {confirmText ? <button>{confirmText}</button> : null}
    </div>
  ),
}));

describe('EnvironmentVersionsPanel Demo-aligned read model', () => {
  it('renders the page head with the environment count badge', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('environmentVersionPageTitle');
    expect(html).toContain('environmentVersionsDescription');
    expect(html).toContain('&quot;count&quot;:2');
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

function candidates(): EnvironmentVersionCandidate[] {
  return ['manifest-1', 'manifest-2'].map((id, index) => ({
    id,
    digest: `sha256:${id}`,
    releaseOrder: { id: `order-${index}`, releaseVersion: `2.4.${index}` },
    buildRun: { id: `build-${index}`, revision: index + 1, sourceCommitSha: 'a'.repeat(40) },
    deploymentRuns: [{ id: `deployment-${index}` }],
    releaseRuns: [
      {
        id: `release-${index}`,
        operationApproval: { id: `approval-${index}`, status: 'approved', consumedAt: null },
      },
    ],
  }));
}
