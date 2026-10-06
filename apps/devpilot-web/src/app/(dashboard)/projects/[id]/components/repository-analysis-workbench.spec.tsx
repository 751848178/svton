import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { RepositoryAnalysisWorkbench } from './repository-analysis-workbench';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('./repository-run-panel', () => ({
  RepositoryRunPanel: () => <div>analysis-records</div>,
}));
vi.mock('./repository-suggestion-review', () => ({
  RepositorySuggestionReview: () => <div>recognized-changes</div>,
}));

describe('RepositoryAnalysisWorkbench', () => {
  it('keeps analysis records and recognized changes in the dedicated workbench', () => {
    const html = render(true);
    expect(html).toContain('repositoryAnalysisPageTitle');
    expect(html).toContain('repositoryAnalysisPageDescription');
    expect(html).toContain('analysis-records');
    expect(html).toContain('recognized-changes');
    expect(html).toContain('repositoryAnalysisStartCurrent');
    expect(html).toContain('/projects/project-1/settings?section=repository');
  });

  it('does not offer a run mutation before the repository is connected', () => {
    const html = render(false);
    expect(html).not.toContain('repositoryAnalysisStartCurrent');
    expect(html).toContain('repositoryAnalysisManageSettings');
  });
});

function render(connected: boolean) {
  return renderToStaticMarkup(
    <RepositoryAnalysisWorkbench
      analysis={
        {
          state: { connection: connected ? { status: 'connected' } : null },
          active: false,
          mutating: false,
          error: '',
          start: vi.fn(),
          load: vi.fn(),
        } as unknown as RepositoryAnalysisHook
      }
      settingsHref="/projects/project-1/settings?section=repository"
      onSelectRun={vi.fn()}
    />,
  );
}
