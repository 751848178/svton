'use client';

import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { ProjectOverviewSummary } from './project-overview-summary';
import { ProjectOverviewTabs } from './project-overview-tabs';
import { ProjectRepositoryDetails } from './project-repository-details';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectOverviewContent(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
  orders: ReleaseOrdersHook;
}) {
  const project = props.detail.project;
  if (!project) return null;
  return (
    <div className="space-y-6">
      <ProjectOverviewSummary detail={props.detail} />
      <ProjectRepositoryDetails analysis={props.analysis} />
      <ProjectOverviewTabs
        detail={props.detail}
        analysis={props.analysis}
        orders={props.orders}
      />
    </div>
  );
}
