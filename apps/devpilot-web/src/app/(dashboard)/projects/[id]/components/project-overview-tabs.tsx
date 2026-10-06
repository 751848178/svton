'use client';

import { useId, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import {
  nextProjectOverviewTab,
  PROJECT_OVERVIEW_TAB_KEYS,
  projectOverviewTabFromSearchParams,
  projectOverviewTabHref,
  type ProjectOverviewTabKey,
} from '../utils/project-overview-tabs.model';
import { repositoryAnalysisPageHref } from '../utils/project-repository-analysis-route';
import { ProjectComponentAnalysisOverview } from './project-component-analysis-overview';
import { ProjectComponentTable } from './project-component-table';
import { ProjectDeliveryContent } from './project-delivery-content';
import { ProjectEnvironmentVersionsTable } from './project-environment-versions-table';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectOverviewTabs(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
  orders: ReleaseOrdersHook;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = props.detail.project;
  const id = useId();
  if (!project) return null;
  const routeParams = new URLSearchParams(searchParams);
  const active = projectOverviewTabFromSearchParams(routeParams);
  const counts: Record<ProjectOverviewTabKey, number> = {
    releases: props.orders.total,
    environments: project.environments?.length ?? 0,
    components: (project.applications ?? []).reduce(
      (total, application) => total + application.services.length,
      0,
    ),
  };

  const select = (tab: ProjectOverviewTabKey) => {
    router.push(projectOverviewTabHref(project.id, routeParams, tab), { scroll: false });
  };

  const selectFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: ProjectOverviewTabKey,
  ) => {
    const next = nextProjectOverviewTab(current, event.key);
    if (next === current && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    select(next);
    document.getElementById(tabId(id, next))?.focus();
  };

  return (
    <section className="min-w-0">
      <div
        role="tablist"
        aria-label={t('projectOverviewContentNavigation')}
        className="scrollbar-none -mx-4 flex min-w-0 gap-5 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0 md:gap-7"
      >
        {PROJECT_OVERVIEW_TAB_KEYS.map((key) => {
          const selected = active === key;
          return (
            <button
              key={key}
              id={tabId(id, key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(id, key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(key)}
              onKeyDown={(event) => selectFromKeyboard(event, key)}
              className={cn(
                'relative flex min-h-11 shrink-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                selected &&
                  'font-semibold text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary',
              )}
            >
              {t(tabLabelKey(key))}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>
      <div
        id={panelId(id, 'releases')}
        role="tabpanel"
        aria-labelledby={tabId(id, 'releases')}
        tabIndex={0}
        hidden={active !== 'releases'}
        className="pt-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProjectDeliveryContent
          projectId={project.id}
          orders={props.orders}
          embedded
        />
      </div>
      <div
        id={panelId(id, 'environments')}
        role="tabpanel"
        aria-labelledby={tabId(id, 'environments')}
        tabIndex={0}
        hidden={active !== 'environments'}
        className="pt-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProjectEnvironmentVersionsTable projectId={project.id} />
      </div>
      <div
        id={panelId(id, 'components')}
        role="tabpanel"
        aria-labelledby={tabId(id, 'components')}
        tabIndex={0}
        hidden={active !== 'components'}
        className="pt-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProjectComponentAnalysisOverview
          analysis={props.analysis}
          analysisHref={repositoryAnalysisPageHref(project.id)}
        />
        <ProjectComponentTable
          detail={props.detail}
          analysis={props.analysis}
        />
      </div>
    </section>
  );
}

function tabLabelKey(key: ProjectOverviewTabKey) {
  if (key === 'releases') return 'releaseRecordsTitle';
  if (key === 'environments') return 'projectOverviewEnvironmentsTitle';
  return 'projectOverviewComponentsTitle';
}

function tabId(id: string, key: ProjectOverviewTabKey) {
  return `${id}-${key}-tab`;
}

function panelId(id: string, key: ProjectOverviewTabKey) {
  return `${id}-${key}-panel`;
}
