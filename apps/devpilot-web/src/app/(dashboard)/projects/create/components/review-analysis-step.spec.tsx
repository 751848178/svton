import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewAnalysisStep } from './review-analysis-step';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';
import type { RepositoryIntakeContract } from '../types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Input: ({ value }: { value: string }) => <span>{value}</span>,
  Select: ({ value }: { value: string }) => <span>{value}</span>,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReviewAnalysisStep', () => {
  it('renders structured repository proof, overview, and component fields', () => {
    const html = renderToStaticMarkup(<ReviewAnalysisStep intake={intake('succeeded')} />);

    expect(html).toContain('main');
    expect(html).toContain('a'.repeat(40));
    expect(html).toContain('team_credential:managed-1');
    expect(html).toContain('monorepo');
    expect(html).toContain('apps/web');
    expect(html).not.toContain('&quot;components&quot;');
  });

  it('renders both pinned retry and reconnect recovery actions', () => {
    const html = renderToStaticMarkup(<ReviewAnalysisStep intake={intake('failed')} />);

    expect(html).toContain('analysis failed');
    expect(html).toContain('intakeRetryPinned');
    expect(html).toContain('intakeReconnectRepository');
  });
});

function intake(status: 'succeeded' | 'failed'): ProjectIntakeHook {
  const contract: RepositoryIntakeContract = {
    version: 1,
    run: {
      id: 'run-1', status, parserVersion: 'parser-v1',
      error: status === 'failed'
        ? { code: 'FAILED', message: 'analysis failed', action: 'retry it' }
        : undefined,
      retry: { allowed: status === 'failed', href: '/retry', label: 'retry' },
    },
    repository: {
      provider: 'local', repositoryUrl: '/fixture', visibility: 'private',
      managedReference: { source: 'team_credential', id: 'managed-1' },
      defaultBranch: 'main', selectedBranch: 'main', commitSha: 'a'.repeat(40),
      verifiedAt: '2026-08-04T00:00:00.000Z',
    },
    overview: {
      suggestionId: 'overview', required: true, decision: null,
      value: {
        projectType: 'web_application', architecture: 'monorepo',
        packageManager: 'pnpm', deploymentPlan: 'container',
      },
    },
    components: [{
      suggestionId: 'web', requiredDependencyIds: ['environment'], decision: null,
      value: {
        name: 'web', path: 'apps/web', type: 'frontend_site',
        buildOutput: 'runtime_bundle', runMethod: 'process',
      },
      warnings: [],
    }],
    dependencies: [{
      suggestionId: 'environment', kind: 'environment', label: 'Production',
      requiredBy: ['web'], decision: null,
    }],
    snapshot: null,
  };
  return {
    run: { id: 'run-1', status, branch: 'main', commitSha: 'a'.repeat(40) },
    contract,
    reviewItems: [
      { suggestionId: 'overview', decision: 'accept' },
      { suggestionId: 'web', decision: 'accept' },
      { suggestionId: 'environment', decision: 'accept' },
    ],
    reviewLocked: false,
    reviewBlockers: [],
    retryAnalysis: vi.fn(),
    setStep: vi.fn(),
    updateReviewOverride: vi.fn(),
    updateReviewDecision: vi.fn(),
  } as unknown as ProjectIntakeHook;
}
