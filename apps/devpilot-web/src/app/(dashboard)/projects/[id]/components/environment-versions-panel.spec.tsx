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
  Button: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <button disabled={disabled}>{children}</button>
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

describe('EnvironmentVersionsPanel copy', () => {
  it('uses role, Environment Version, BuildRun, Manifest and governed action copy', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionsPanel projectId="project-1" />);

    expect(html).toContain('releaseEnvironmentStaging');
    expect(html).toContain('releaseEnvironmentProduction');
    expect(html.match(/environmentVersionSummary/g)).toHaveLength(6);
    expect(html).toContain('environmentVersionKindDeploy');
    expect(html).toContain('environmentVersionKindRecovery');
    expect(html).toContain('environmentVersionBuildRun');
    expect(html).toContain('environmentVersionCandidateOption');
    expect(html).toContain('environmentVersionUpgrade');
    expect(html).toContain('environmentVersionRecover');
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
  return (['staging', 'production'] as const).map((role) => ({
    id: `environment-${role}`,
    key: role,
    name: role,
    baselineRole: role,
    currentEnvironmentVersionId: `version-${role}-current`,
    environmentVersions: [
      version(`version-${role}-current`, 'manifest-1', 'deploy'),
      version(`version-${role}-history`, 'manifest-2', 'recovery'),
    ],
  }));
}

function version(id: string, manifestId: string, kind: EnvironmentVersionItem['kind']) {
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
  } satisfies EnvironmentVersionItem;
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
