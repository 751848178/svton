import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { RepositoryIdentityMigrationRequiredCard } from './repository-identity-migration-required-card';
import { RepositoryLockedIdentityCard } from './repository-locked-identity-card';
import { ReleaseBuildLogDrawer } from './release-build-log-drawer';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@svton/ui', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Drawer: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <aside>{children}</aside> : null,
}));
vi.mock('@/components/ui', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
  StatusTag: ({ label }: { label: ReactNode }) => <span>{label}</span>,
}));

describe('repository identity UI', () => {
  it('renders a locked canonical identity with separated recovery actions', () => {
    const html = renderToStaticMarkup(<RepositoryLockedIdentityCard analysis={analysis()} />);
    expect(html).toContain('repositoryIdentityTitle');
    expect(html).toContain('github');
    expect(html).toContain('https://github.com/example/service');
    expect(html).toContain('R1');
    expect(html).toContain('repositoryCredentialReconnectAction');
    expect(html).toContain('repositoryBranchRevisionAction');
    expect(html).toContain('category=repository_analysis');
    expect(html).not.toContain('连接只读代码仓库');
  });

  it('renders an explicit fail-closed migration state', () => {
    const html = renderToStaticMarkup(<RepositoryIdentityMigrationRequiredCard />);
    expect(html).toContain('repositoryIdentityMigrationTitle');
    expect(html).toContain('repositoryIdentityMigrationDescription');
  });

  it('shows BuildRun provider, canonical URL, revision, branch and commit', () => {
    const html = renderToStaticMarkup(
      <ReleaseBuildLogDrawer
        run={build()}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('github');
    expect(html).toContain('https://github.com/example/service');
    expect(html).toContain('R2');
    expect(html).toContain('release');
    expect(html).toContain('b'.repeat(40));
  });
});

function analysis(): RepositoryAnalysisHook {
  return {
    projectId: 'project-1',
    mutating: false,
    error: '',
    load: vi.fn(),
    reconnect: vi.fn(),
    reviseBranch: vi.fn(),
    state: {
      locked: true,
      identityStatus: 'locked',
      canonicalIdentity: {
        id: 'identity-1',
        provider: 'github',
        canonicalUrl: 'https://github.com/example/service',
        lockedAt: '2026-08-04T00:00:00.000Z',
        effectiveRevision: {
          id: 'revision-1',
          revision: 1,
          defaultBranch: 'main',
          reason: 'initial',
          createdAt: '2026-08-04T00:00:00.000Z',
        },
      },
      connection: {
        id: 'connection-1',
        repositoryUrl: 'git@github.com:example/service.git',
        provider: 'github',
        visibility: 'public',
        credentialSource: 'none',
        defaultBranch: 'main',
        selectedBranch: 'main',
        commitSha: 'a'.repeat(40),
        status: 'connected',
      },
      credentialOptions: [],
      readiness: { connected: true, analyzed: true, applied: true, complete: true },
      allowedActions: { reconnectCredentials: true, reviseBranch: true },
    },
  } as unknown as RepositoryAnalysisHook;
}

function build(): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'release',
    sourceCommitSha: 'b'.repeat(40),
    sourceRepository: {
      provider: 'github',
      canonicalUrl: 'https://github.com/example/service',
      identityRevisionId: 'revision-2',
      identityRevision: 2,
      branch: 'release',
    },
    status: 'succeeded',
    logReference: 'build-log://build-1',
    logSummary: { redacted: true, lines: ['ok'] },
    gateSummary: {},
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-08-04T00:00:00.000Z',
    finishedAt: '2026-08-04T00:01:00.000Z',
    createdAt: '2026-08-04T00:00:00.000Z',
    manifest: null,
  };
}
