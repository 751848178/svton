'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import type { useProjectDetail } from '../hooks/use-project-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectOverviewSummary(props: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const project = props.detail.project;
  if (!project) return null;
  const environmentCount = project.environments?.length ?? 0;
  const componentCount =
    project.applications?.reduce(
      (count, application) => count + (application.services?.length ?? 0),
      0,
    ) ?? 0;
  return (
    <section aria-labelledby="project-basic-information-title">
      <h2
        id="project-basic-information-title"
        className="text-[15px] font-semibold tracking-[-0.015em]"
      >
        {t('projectBasicInformationTitle')}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:gap-x-7 lg:grid-cols-3 lg:gap-x-10">
        <ProjectFact
          className="col-span-2 lg:col-span-1"
          label={t('projectDescriptionField')}
        >
          {project.description?.trim() || t('projectDescriptionUnavailable')}
        </ProjectFact>
        <ProjectFact label={t('projectEnvironmentComponentOverview')}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {t('projectEnvironmentCount', { count: environmentCount })}
            <span
              className="text-muted-foreground"
              aria-hidden="true"
            >
              ·
            </span>
            {t('componentCount', { count: componentCount })}
          </span>
          <small className="text-xs font-normal text-muted-foreground">
            {t('projectEnvironmentComponentOverviewHint')}
          </small>
        </ProjectFact>
        <ProjectFact
          className="col-span-2 lg:col-span-1"
          label={t('projectCreatedByField')}
        >
          {project.createdBy?.name?.trim() ||
            project.createdBy?.email ||
            t('projectCreatorUnavailable')}
        </ProjectFact>
        <ProjectFact label={t('projectCreatedAtField')}>
          {formatDateTimeMinute(project.createdAt)}
        </ProjectFact>
        <ProjectFact label={t('projectUpdatedAtField')}>
          {formatDateTimeMinute(project.updatedAt)}
        </ProjectFact>
      </div>
    </section>
  );
}

function ProjectFact({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid min-h-[52px] min-w-0 content-center gap-1', className)}>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <strong className="grid min-w-0 gap-1 break-words text-sm font-medium leading-5">
        {children}
      </strong>
    </div>
  );
}
