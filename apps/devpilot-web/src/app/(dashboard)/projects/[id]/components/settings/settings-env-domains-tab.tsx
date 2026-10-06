'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useSites } from '@/app/(dashboard)/sites/hooks/use-sites';
import { useEnvironmentConfigGovernance } from '../../hooks/use-environment-config-governance';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { ProjectDomainsEnvironmentContent } from '../project-domains-environment-section';

type DetailHook = ReturnType<typeof useProjectDetail>;
type GovernanceHook = ReturnType<typeof useEnvironmentConfigGovernance>;

export function EnvDomainsTab(props: {
  detail: DetailHook;
  environment: ProjectEnvironment;
  governance: GovernanceHook;
}) {
  const searchParams = useSearchParams();
  const project = props.detail.project;
  const sites = useSites(
    project?.id ?? '',
    props.environment.id,
    '',
    searchParams.get('new') === 'true',
  );
  const items = useMemo(
    () => sites.sites.filter((site) => site.environment?.id === props.environment.id),
    [props.environment.id, sites.sites],
  );
  if (!project) return null;
  if (sites.loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      {sites.error ? (
        <ErrorBanner
          message={sites.error}
          onRetry={sites.reload}
        />
      ) : null}
      <ProjectDomainsEnvironmentContent
        project={project}
        environment={props.environment}
        items={items}
        runs={props.detail.deploymentRuns}
        sites={sites}
        governance={props.governance}
        onProjectReload={props.detail.loadProject}
      />
    </div>
  );
}
