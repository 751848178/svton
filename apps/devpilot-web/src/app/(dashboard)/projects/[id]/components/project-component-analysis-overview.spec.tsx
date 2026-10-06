import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { ProjectComponentAnalysisOverview } from './project-component-analysis-overview';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

describe('ProjectComponentAnalysisOverview', () => {
  it('shows only real component suggestions from the latest run', () => {
    const html = renderToStaticMarkup(
      <ProjectComponentAnalysisOverview
        analysis={analysis()}
        analysisHref="/projects/project-1/repository-analysis"
      />,
    );
    expect(html).toContain('projectComponentAnalysisTitle');
    expect(html).toContain('repositoryRunStatusSucceeded');
    expect(html).toContain('main@aaaaaaaaaaaa');
    expect(html).toContain('projectComponentAnalysisResult');
    expect(html).toContain('&quot;count&quot;:1');
    expect(html).toContain('&quot;pending&quot;:1');
    expect(html).toContain('projectComponentAnalysisViewFull');
    expect(html).toContain('/projects/project-1/repository-analysis');
    expect(html).not.toContain('justify-between');
    expect(html.indexOf('projectComponentAnalysisTitle')).toBeLessThan(
      html.indexOf('projectComponentAnalysisViewFull'),
    );
    expect(html.indexOf('projectComponentAnalysisViewFull')).toBeLessThan(
      html.indexOf('repositoryRunStatusSucceeded'),
    );
  });

  it('does not infer a component count from the total suggestion count', () => {
    const value = analysis();
    value.selectedRun = null;
    value.runs[0] = { ...value.runs[0], suggestions: undefined, _count: { suggestions: 8 } };
    const html = renderToStaticMarkup(
      <ProjectComponentAnalysisOverview
        analysis={value}
        analysisHref="/projects/project-1/repository-analysis"
      />,
    );
    expect(html).toContain('projectComponentAnalysisResultUnavailable');
    expect(html).not.toContain('&quot;count&quot;:8');
  });
});

function analysis(): RepositoryAnalysisHook {
  const run = {
    id: 'run-1',
    status: 'succeeded' as const,
    branch: 'main',
    commitSha: 'a'.repeat(40),
    parserVersion: 'v1',
    createdAt: '2026-08-28T10:00:00.000Z',
    finishedAt: '2026-08-28T10:01:00.000Z',
    suggestions: [
      suggestion('service-1', 'application_service', 'pending'),
      suggestion('environment-1', 'environment', 'applied'),
    ],
  };
  return {
    loading: false,
    error: '',
    load: vi.fn(),
    runs: [run],
    selectedRun: run,
    state: { connection: { status: 'connected' } },
  } as unknown as RepositoryAnalysisHook;
}

function suggestion(id: string, kind: string, status: string) {
  return {
    id,
    key: id,
    kind,
    confidence: 'high',
    conflict: false,
    impact: 'review',
    proposedValue: {},
    status,
  };
}
