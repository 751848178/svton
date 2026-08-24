import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDomainsRoute } from './project-domains-route';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  EmptyState: ({ text }: { text: string }) => <div>{text}</div>,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  ConfirmDialog: () => null,
  ErrorBanner: () => <div>error</div>,
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children?: React.ReactNode;
  }) => <select {...props}>{children}</select>,
}));
vi.mock('@/app/(dashboard)/sites/hooks/use-sites', () => ({
  useSites: () => ({
    sites: [],
    loading: false,
    error: '',
    showModal: false,
    editTarget: null,
    deleteTarget: null,
    setShowModal: vi.fn(),
    setEditTarget: vi.fn(),
    handleCreatePlan: vi.fn(),
    handleDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock('../hooks/use-project-detail', () => ({ useProjectDetail: () => detail() }));
vi.mock('./project-workbench-header', () => ({ ProjectWorkbenchHeader: () => null }));
vi.mock('./project-context-issue', () => ({ ProjectContextIssue: () => null }));
vi.mock('./project-domains-table', () => ({ ProjectDomainsTable: () => null }));

describe('ProjectDomainsRoute existing environment selector', () => {
  it('does not expose empty legacy candidates as domain environments', () => {
    const html = renderToStaticMarkup(<ProjectDomainsRoute />);
    expect(html).toContain('Dev (dev)');
    expect(html).toContain('Staging (staging)');
    expect(html).toContain('Production (production)');
    expect(html).not.toContain('Test (test)');
    expect(html).not.toContain('Prod candidate (prod)');
  });
});

function detail() {
  const seed = {
    source: 'project_config',
    initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
  };
  return {
    loading: false,
    error: '',
    loadProject: vi.fn(),
    project: {
      id: 'project-1',
      name: 'Picshare',
      gitRepo: 'file:///repo',
      applications: [],
      environments: [
        {
          id: 'dev',
          key: 'dev',
          name: 'Dev',
          status: 'active',
          sortOrder: 1,
          config: seed,
          _count: { deploymentRuns: 1 },
        },
        {
          id: 'test',
          key: 'test',
          name: 'Test',
          status: 'active',
          sortOrder: 2,
          config: seed,
          _count: {},
        },
        {
          id: 'staging',
          key: 'staging',
          name: 'Staging',
          status: 'active',
          sortOrder: 3,
          baselineRole: 'staging',
          config: seed,
          _count: {},
        },
        {
          id: 'production',
          key: 'production',
          name: 'Production',
          status: 'active',
          sortOrder: 4,
          baselineRole: 'production',
          config: null,
          _count: {},
        },
        {
          id: 'prod',
          key: 'prod',
          name: 'Prod candidate',
          status: 'active',
          sortOrder: 5,
          config: seed,
          _count: {},
        },
      ],
    },
  } as never;
}
