import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteHost } from './project-route-host';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(), searchParams: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  EmptyState: () => <div>empty</div>,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: () => <div>error</div>,
  PageHeader: () => <div>page-header</div>,
}));
vi.mock('../hooks/use-project-detail', () => ({ useProjectDetail: () => detail() }));
vi.mock('../hooks/use-repository-analysis.hooks', () => ({
  useRepositoryAnalysis: () => analysis(),
}));
vi.mock('./project-delivery-route', () => ({
  ProjectDeliveryRoute: () => <div>delivery-route</div>,
}));
vi.mock('./project-information-panel', () => ({
  ProjectInformationPanel: () => <div>information-panel</div>,
}));
vi.mock('./project-settings-content', () => ({
  ProjectSettingsContent: () => <div>settings-panel</div>,
}));
vi.mock('./project-workbench-header', () => ({
  ProjectWorkbenchHeader: () => <div>workbench-header</div>,
}));
vi.mock('./release-delivery-compatibility-banner', () => ({
  ReleaseDeliveryCompatibilityDetails: () => <div>compatibility</div>,
}));

describe('ProjectRouteHost top-level information architecture', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
  });

  it('opens project information by default', () => {
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);
    expect(html).toContain('workbench-header');
    expect(html).toContain('information-panel');
    expect(html).not.toContain('delivery-route');
  });

  it('EV-1: an unsupported view shows the redirect placeholder instead of silently falling back', () => {
    mocks.searchParams = new URLSearchParams('view=environment-versions');
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);
    // 命中重定向占位（loading），不静默渲染项目信息视图
    expect(html).toContain('loading');
    expect(html).not.toContain('workbench-header');
  });

  it('IA: legacy ?view=releases shows the redirect placeholder (href 断言在 utils spec)', () => {
    mocks.searchParams = new URLSearchParams('view=releases&create=true');
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);
    expect(html).toContain('loading');
    expect(html).not.toContain('delivery-route');
  });

  it('IA: legacy ?view=deployments shows the redirect placeholder (href 断言在 utils spec)', () => {
    mocks.searchParams = new URLSearchParams('view=deployments&runId=run-1');
    const html = renderToStaticMarkup(<ProjectRouteHost mode="delivery" />);
    expect(html).toContain('loading');
    expect(html).not.toContain('delivery-route');
  });

  it('renders project configuration as a peer top-level area', () => {
    const html = renderToStaticMarkup(<ProjectRouteHost mode="settings" />);
    expect(html).toContain('workbench-header');
    expect(html).toContain('settings-panel');
  });
});

function detail() {
  return {
    loading: false,
    project: { id: 'project-1', name: 'Picshare', gitRepo: 'file:///repo', applications: [] },
    deploymentRuns: [],
    error: '',
    loadProject: vi.fn(),
  } as never;
}

function analysis() {
  return { state: { canonicalIdentity: null }, selectedRun: null } as never;
}
