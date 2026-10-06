import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectOverviewSummary } from './project-overview-summary';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));
describe('project overview information hierarchy', () => {
  it('shows real project basics without repeating repository identity', () => {
    const html = renderToStaticMarkup(<ProjectOverviewSummary detail={detail()} />);
    expect(html).toContain('A real project description');
    expect(html).toContain('Project owner');
    expect(html).toContain('2026-08-01 10:30');
    expect(html).toContain('2026-08-27 18:45');
    expect(html).toContain('projectEnvironmentCount:{&quot;count&quot;:2}');
    expect(html).toContain('componentCount:{&quot;count&quot;:2}');
    expect(html).toContain('projectEnvironmentComponentOverview');
    expect(html).not.toContain('border-y');
    expect(html).not.toContain('border-t');
    expect(html).not.toContain('border-b');
    expect(html).not.toContain('https://example.test/project.git');
    expect(html).not.toContain('viewRepositoryAnalysis');
    expect(html).toContain('lg:grid-cols-3');
    expect(html).not.toContain('xl:grid-cols-4');
    expect(html).not.toContain('releasePolicyField');
    expect(html).not.toContain('productionApprovalRequired');
    expect(html.indexOf('projectDescriptionField')).toBeLessThan(
      html.indexOf('projectEnvironmentComponentOverview'),
    );
    expect(html.indexOf('projectEnvironmentComponentOverview')).toBeLessThan(
      html.indexOf('projectCreatedByField'),
    );
    expect(html.indexOf('projectCreatedByField')).toBeLessThan(
      html.indexOf('projectCreatedAtField'),
    );
    expect(html.indexOf('projectCreatedAtField')).toBeLessThan(
      html.indexOf('projectUpdatedAtField'),
    );
  });
});

function detail() {
  return {
    project: {
      id: 'project-1',
      name: 'Project',
      description: 'A real project description',
      gitRepo: 'https://example.test/project.git',
      downloadUrl: null,
      config: {},
      createdAt: '2026-08-01T10:30:00+08:00',
      updatedAt: '2026-08-27T18:45:00+08:00',
      createdBy: { id: 'user-1', name: 'Project owner', email: 'owner@example.test' },
      environments: [
        { id: 'env-1', key: 'staging', name: 'Staging' },
        { id: 'env-2', key: 'production', name: 'Production' },
      ],
      applications: [{ id: 'app-1', name: 'App', services: [{ id: 'a' }, { id: 'b' }] }],
    },
  } as never;
}
