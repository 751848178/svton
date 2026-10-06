import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDeploymentsRoute } from './project-deployments-route';

const mocks = vi.hoisted(() => ({
  useProjectDetail: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useSearchParams: () => new URLSearchParams('runId=run-1'),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ LoadingState: () => <div>loading</div> }));
vi.mock('@/components/ui', () => ({ ErrorBanner: () => <div>error</div> }));
vi.mock('../hooks/use-project-detail', () => ({
  useProjectDetail: mocks.useProjectDetail,
}));
vi.mock('../hooks/use-project-delivery-summary', () => ({
  useProjectDeliverySummary: () => ({ summary: null }),
}));
vi.mock('../hooks/use-repository-analysis.hooks', () => ({
  useRepositoryAnalysis: () => ({ state: { canonicalIdentity: null, connection: null } }),
}));
vi.mock('./project-workbench-header', () => ({ ProjectWorkbenchHeader: () => null }));
vi.mock('./project-delivery-issue', () => ({ ProjectDeliveryIssue: () => null }));
vi.mock('./project-deployment-runs-table', () => ({
  ProjectDeploymentRunsTable: ({ focusedRunId }: { focusedRunId?: string }) => (
    <div>{focusedRunId}</div>
  ),
}));

describe('ProjectDeploymentsRoute deployment run deep link', () => {
  it('keeps runId scoped to the deployment table instead of reloading project detail', () => {
    mocks.useProjectDetail.mockReturnValue({
      loading: false,
      error: '',
      project: { id: 'project-1', name: 'Project', environments: [] },
    });

    const html = renderToStaticMarkup(<ProjectDeploymentsRoute />);

    expect(mocks.useProjectDetail).toHaveBeenCalledWith('project-1');
    expect(html).toContain('run-1');
    expect(html).toContain('data-project-deployments-root="true"');
    expect(html).toContain('h-[calc(100dvh-11.3125rem)]');
    expect(html).toContain('md:h-[calc(100dvh-10.25rem)]');
    expect(html).toContain('contain:layout paint');
    expect(html).toContain('flex min-h-0 min-w-0 max-w-full flex-1 flex-col');
  });
});
