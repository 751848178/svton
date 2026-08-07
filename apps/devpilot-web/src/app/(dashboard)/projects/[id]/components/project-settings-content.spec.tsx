import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSettingsContent } from './project-settings-content';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  analysis: { loading: false, error: '', data: null },
  detail: {
    loading: false,
    error: '',
    project: { id: 'project-1', name: 'Picshare' },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui', () => ({
  LinkButton: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('../hooks/use-repository-analysis.hooks', () => ({
  useRepositoryAnalysis: () => mocks.analysis,
}));
vi.mock('./settings/environment-settings-area', () => ({
  EnvironmentSettingsArea: () => <div>settings-environment-area</div>,
}));
vi.mock('./tabs/repository-tab', () => ({
  RepositoryTab: ({ onSelectRun }: { onSelectRun: (runId: string) => void }) => (
    <div>repository-tab</div>
  ),
}));
vi.mock('./tabs/release-policy-tab', () => ({
  ReleasePolicyTab: () => <div>release-policy-tab</div>,
}));
vi.mock('./tabs/resources-tab', () => ({ ResourcesTab: () => <div>resources-tab</div> }));
vi.mock('./tabs/webhooks-tab', () => ({ WebhooksTab: () => <div>webhooks-tab</div> }));
vi.mock('./tabs/settings-tab', () => ({ SettingsTab: () => <div>settings-tab</div> }));

describe('ProjectSettingsContent Demo-aligned information architecture', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
  });

  it('is an independent route page with three top-level low-frequency areas only', () => {
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />);

    expect(html).toContain('settingsPageTitle');
    expect(html).toContain('settingsPageDescription');
    expect(html).toContain('backToReleaseManagement');
    expect(html).toContain('settingsAreaIdentity');
    expect(html).toContain('settingsAreaEnvironments');
    expect(html).toContain('settingsAreaReleasePolicy');
    expect(html).not.toContain('tabResources');
    expect(html).not.toContain('tabWebhooks');
    expect(html).not.toContain('settingsSectionGeneral');
    expect(html).not.toContain('settingsLegacySectionHint');
    expect(html).toContain('repository-tab');
  });

  it('switches areas through the settings deep link section param', () => {
    mocks.searchParams = new URLSearchParams('section=environments');
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />);

    expect(html).toContain('settings-environment-area');
    expect(html).toContain('aria-current="page"');
  });

  it('keeps legacy resources/webhooks/general sections deep-linkable with a hint', () => {
    mocks.searchParams = new URLSearchParams('section=resources');
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />);

    expect(html).toContain('settingsLegacySectionHint');
    expect(html).toContain('resources-tab');

    mocks.searchParams = new URLSearchParams('section=webhooks');
    expect(
      renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />),
    ).toContain('webhooks-tab');

    mocks.searchParams = new URLSearchParams('section=general');
    expect(
      renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />),
    ).toContain('settings-tab');
  });

  it('renders the release rules area from the release-policy section', () => {
    mocks.searchParams = new URLSearchParams('section=release-policy');
    const html = renderToStaticMarkup(<ProjectSettingsContent detail={mocks.detail as never} />);

    expect(html).toContain('release-policy-tab');
  });
});
