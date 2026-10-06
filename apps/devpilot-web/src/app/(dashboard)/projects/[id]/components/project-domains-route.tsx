'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner, Select } from '@/components/ui';
import { useSites } from '@/app/(dashboard)/sites/hooks/use-sites';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { projectIdentityFromProject } from '../utils/project-workbench-identity.model';
import { ProjectDomainsEnvironmentSection } from './project-domains-environment-section';
import { selectProjectDomainEnvironments } from './project-domain-workflow.model';
import { ProjectDeliveryIssue } from './project-delivery-issue';
import { ProjectWorkbenchHeader } from './project-workbench-header';

export function ProjectDomainsRoute() {
  const t = useTranslations('projects');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);
  const delivery = useProjectDeliverySummary(projectId);
  const analysis = useRepositoryAnalysis(projectId);
  const [environmentId, setEnvironmentId] = useState(searchParams.get('environmentId') || '');
  const sites = useSites(projectId, '', '', searchParams.get('new') === 'true');
  const environments = useMemo(
    () => selectProjectDomainEnvironments(detail.project?.environments, sites.sites),
    [detail.project?.environments, sites.sites],
  );
  const activeEnvironmentId = environments.some((item) => item.id === environmentId)
    ? environmentId
    : environments[0]?.id || '';
  const filtered = useMemo(
    () =>
      sites.sites.filter(
        (site) => !activeEnvironmentId || site.environment?.id === activeEnvironmentId,
      ),
    [activeEnvironmentId, sites.sites],
  );
  if (detail.loading || sites.loading) return <LoadingState />;
  const project = detail.project;
  if (!project)
    return (
      <ErrorBanner
        message={detail.error || t('projectNotFound')}
        onRetry={detail.loadProject}
      />
    );
  const activeEnvironment = environments.find((item) => item.id === activeEnvironmentId);
  const selectEnvironment = (value: string) => {
    setEnvironmentId(value);
    const next = new URLSearchParams(searchParams.toString());
    next.set('environmentId', value);
    next.delete('new');
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  return (
    <div className="space-y-6">
      <ProjectWorkbenchHeader
        identity={projectIdentityFromProject(project, analysis)}
        issue={<ProjectDeliveryIssue summary={delivery.summary ?? null} />}
      />
      <section className="space-y-4">
        <div className="flex justify-end">
          <Select
            className="w-auto max-w-full bg-background"
            value={activeEnvironmentId}
            onChange={(event) => selectEnvironment(event.target.value)}
          >
            {environments.map((environment) => (
              <option
                key={environment.id}
                value={environment.id}
              >
                {environment.name} ({environment.key})
              </option>
            ))}
          </Select>
        </div>
        {sites.error ? (
          <ErrorBanner
            message={sites.error}
            onRetry={sites.reload}
          />
        ) : null}
        {activeEnvironment ? (
          <ProjectDomainsEnvironmentSection
            project={project}
            environment={activeEnvironment}
            items={filtered}
            runs={detail.deploymentRuns}
            sites={sites}
            onProjectReload={detail.loadProject}
          />
        ) : null}
      </section>
    </div>
  );
}
