import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSettingsContent } from './project-settings-content';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./project-context-issue', () => ({
  ProjectContextIssue: ({ message, actionLabel }: { message: string; actionLabel: string }) => (
    <div>
      {message} · {actionLabel}
    </div>
  ),
}));
vi.mock('./settings/environment-settings-area', () => ({
  EnvironmentSettingsArea: () => <div>environment-settings-area</div>,
}));

describe('ProjectSettingsContent project-configuration scope', () => {
  it('shows a contextual production-entry repair link beside the problem', () => {
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={detail(false)} />);
    expect(html).toContain('productionEntryMissing');
    expect(html).toContain('configureProductionEntry');
    expect(html).toContain('environment-settings-area');
  });

  it('removes the issue after a production Site exists', () => {
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={detail(true)} />);
    expect(html).not.toContain('productionEntryMissing');
    expect(html).toContain('environment-settings-area');
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
