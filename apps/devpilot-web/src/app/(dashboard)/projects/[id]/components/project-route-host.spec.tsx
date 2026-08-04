import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteHost } from './project-route-host';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  useProjectDetail: vi.fn(),
  useProjectDeliverySummary: vi.fn(),
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
  LinkButton: () => <div>link</div>,
  PageHeader: () => <div>header</div>,
}));
vi.mock('../hooks/use-project-detail', () => ({ useProjectDetail: mocks.useProjectDetail }));
vi.mock('../hooks/use-project-delivery-summary', () => ({
  useProjectDeliverySummary: mocks.useProjectDeliverySummary,
}));
vi.mock('./project-delivery-content', () => ({
  ProjectDeliveryContent: () => <div>delivery</div>,
}));
vi.mock('./project-delivery-header', () => ({
  ProjectDeliveryHeader: () => <div>delivery-header</div>,
}));
vi.mock('./project-delivery-summary', () => ({
  ProjectDeliveryEnvironmentStrip: () => <div>versions</div>,
  ProjectDeliveryWeakSummary: () => <div>summary</div>,
}));
vi.mock('./project-detail-header', () => ({ ProjectDetailHeader: () => <div>detail-header</div> }));
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
    mocks.useProjectDeliverySummary.mockReset();
    mocks.useProjectDeliverySummary.mockReturnValue({
      summary: { project: { name: 'Project 1' } },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it('does not load the low-frequency project detail graph on the delivery home', () => {
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);

    expect(html).toContain('delivery-header');
    expect(html).toContain('delivery');
    expect(mocks.useProjectDeliverySummary).toHaveBeenCalledWith('project-1', undefined);
    expect(mocks.useProjectDetail).not.toHaveBeenCalled();
  });
});
