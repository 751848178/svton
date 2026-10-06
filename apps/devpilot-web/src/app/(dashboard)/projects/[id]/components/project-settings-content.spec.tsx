import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSettingsContent } from './project-settings-content';

let query = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock('./settings/environment-settings-area', () => ({
  EnvironmentSettingsArea: () => <div>environment-settings-area</div>,
}));
vi.mock('./repository-settings-panel', () => ({
  RepositorySettingsPanel: () => <div>repository-settings-panel</div>,
}));

describe('ProjectSettingsContent project-configuration scope', () => {
  it('renders configuration without duplicating the project-level issue', () => {
    query = '';
    const html = renderToStaticMarkup(
      <ProjectSettingsContent
        detail={detail(false)}
        analysis={{} as never}
        onRepositoryRunCreated={vi.fn()}
      />,
    );
    expect(html).not.toContain('productionEntryMissing');
    expect(html).toContain('environment-settings-area');
  });

  it('renders project-level repository settings without an environment scope', () => {
    query = 'section=repository';
    const html = renderToStaticMarkup(
      <ProjectSettingsContent
        detail={detail(false)}
        analysis={{} as never}
        onRepositoryRunCreated={vi.fn()}
      />,
    );
    expect(html).toContain('repository-settings-panel');
    expect(html).not.toContain('environment-settings-area');
  });
});

function detail(withSite: boolean) {
  return {
    project: {
      id: 'project-1',
      environments: [{ id: 'production-1', baselineRole: 'production' }],
      sites: withSite ? [{ id: 'site-1', environment: { id: 'production-1' } }] : [],
    },
  } as never;
}
