import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteHost } from './project-route-host';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  useProjectDetail: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  EmptyState: () => <div>empty</div>,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: () => <div>error</div>,
  LinkButton: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  PageHeader: () => <div>header</div>,
}));
vi.mock('../hooks/use-project-detail', () => ({ useProjectDetail: mocks.useProjectDetail }));
vi.mock('./project-delivery-route', () => ({
  ProjectDeliveryRoute: () => <div>delivery-route</div>,
}));
vi.mock('./project-detail-header', () => ({
  ProjectDetailHeader: ({ actions }: { actions: React.ReactNode }) => (
    <div>detail-header{actions}</div>
  ),
}));
vi.mock('./project-settings-content', () => ({
  ProjectSettingsContent: () => <div>settings</div>,
}));
vi.mock('./tabs/deployments-tab', () => ({ DeploymentsTab: () => <div>deployments</div> }));
vi.mock('./release-delivery-compatibility-banner', () => ({
  ReleaseDeliveryCompatibilityBanner: () => <div>compatibility</div>,
}));

describe('ProjectRouteHost', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.useProjectDetail.mockReset();
  });

  it('does not load the low-frequency project detail graph on the delivery home', () => {
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);

    expect(html).toContain('delivery-route');
    expect(mocks.useProjectDetail).not.toHaveBeenCalled();
  });

  it('keeps an exact DeploymentRun deep link secondary and read-only', () => {
    mocks.searchParams = new URLSearchParams('view=deployments&runId=run-1');
    mocks.useProjectDetail.mockReturnValue({
      loading: false,
      project: { id: 'project-1' },
      error: '',
    });
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);

    expect(mocks.useProjectDetail).toHaveBeenCalledWith('project-1', 'run-1');
    expect(html).toContain('professionalDeploymentView');
    expect(html).toContain('deployments');
    expect(html).toContain('href="/projects/project-1"');
    expect(html).not.toContain('/settings');
  });
});
