import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectsContent } from './ProjectsContent';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ LoadingState: () => <div>loading</div> }));
vi.mock('@/components/ui', () => ({
  PageHeader: ({ title, description, actions }: Record<string, React.ReactNode>) => (
    <header>{title}{description}{actions}</header>
  ),
  ErrorBanner: () => <div>error</div>,
}));
vi.mock('../hooks/use-projects', () => ({
  useProjects: () => ({
    summary: {}, search: '', statusFilter: 'all', total: 1,
    setSearch: vi.fn(), setStatusFilter: vi.fn(), filtered: false,
    resetFilters: vi.fn(), loading: false, validating: false,
    error: null, refresh: vi.fn(), items: [],
  }),
}));
vi.mock('./directory-summary', () => ({ DirectorySummary: () => <div>summary</div> }));
vi.mock('./directory-toolbar', () => ({ DirectoryToolbar: () => <div>toolbar</div> }));
vi.mock('./project-directory-empty', () => ({ ProjectDirectoryEmpty: () => <div>empty</div> }));
vi.mock('./project-directory-panel', () => ({ ProjectDirectoryPanel: () => <div>panel</div> }));

describe('ProjectsContent V13 primary action hierarchy', () => {
  it('keeps creation in the canonical navigation entry instead of duplicate page CTAs', () => {
    const html = renderToStaticMarkup(<ProjectsContent />);
    expect(html).toContain('pageTitle');
    expect(html).not.toContain('connectExistingProject');
    expect(html).not.toContain('generateProject');
  });
});
