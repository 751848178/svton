import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectOverviewTabs } from './project-overview-tabs';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

let routeQuery = '';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(routeQuery),
}));
vi.mock('./project-delivery-content', () => ({
  ProjectDeliveryContent: () => <div>release-content</div>,
}));
vi.mock('./project-environment-versions-table', () => ({
  ProjectEnvironmentVersionsTable: () => <div>environment-content</div>,
}));
vi.mock('./project-component-analysis-overview', () => ({
  ProjectComponentAnalysisOverview: () => <div>component-analysis</div>,
}));
vi.mock('./project-component-table', () => ({
  ProjectComponentTable: () => <div>component-content</div>,
}));

describe('ProjectOverviewTabs', () => {
  it('defaults to release records and exposes related accessible panels', () => {
    routeQuery = '';
    const html = renderToStaticMarkup(
      <ProjectOverviewTabs
        detail={
          {
            project: {
              id: 'project-1',
              environments: [{ id: 'environment-1' }],
              applications: [{ services: [{ id: 'service-1' }, { id: 'service-2' }] }],
            },
          } as never
        }
        analysis={{} as never}
        orders={{ total: 3 } as never}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="projectOverviewContentNavigation"');
    expect(html).toContain('role="tab" aria-selected="true"');
    expect(html).toContain('releaseRecordsTitle');
    expect(html).toContain('projectOverviewEnvironmentsTitle');
    expect(html).toContain('projectOverviewComponentsTitle');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('release-content');
    expect(html).toContain('environment-content');
    expect(html).toContain('component-analysis');
    expect(html).toContain('component-content');
  });

  it('selects the component panel from the URL deep link', () => {
    routeQuery = 'view=components';
    const html = renderToStaticMarkup(
      <ProjectOverviewTabs
        detail={
          {
            project: { id: 'project-1', environments: [], applications: [] },
          } as never
        }
        analysis={{} as never}
        orders={{ total: 0 } as never}
      />,
    );
    expect(html).toMatch(/role="tab" aria-selected="true" aria-controls="[^"]*components-panel"/);
    expect(html).toContain('component-analysis');
  });
});
