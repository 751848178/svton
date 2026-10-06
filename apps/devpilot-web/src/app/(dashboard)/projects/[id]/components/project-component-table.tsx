'use client';

import { useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { ProjectService } from '../types';
import {
  projectComponentAnalysisCommit,
  projectComponentPath,
  projectComponentPorts,
} from '../utils/project-component-display.model';
import { getServiceStatusLabelKey } from '../utils/service-status.model';
import { ProjectComponentDetailsModal } from './project-component-details-modal';
import {
  PROJECT_COMPACT_ACTION_CLASS,
  PROJECT_TABLE_CLASS,
  ProjectTableSurface,
} from './project-workbench-surface';

export { findChange } from '../utils/project-component-display.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface SelectedComponent {
  service: ProjectService;
  applicationName: string;
}

export function ProjectComponentTable(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
}) {
  const t = useTranslations('projects');
  const [selected, setSelected] = useState<SelectedComponent | null>(null);
  const applications = props.detail.project?.applications ?? [];
  if (applications.length === 0) return <EmptyState text={t('noLinkedApps')} />;

  return (
    <>
      <ProjectTableSurface variant="embedded">
        <table className={`${PROJECT_TABLE_CLASS} min-w-[920px]`}>
          <caption className="sr-only">
            {t('projectComponentsTitle')}. {t('projectComponentsOverviewDescription')}
          </caption>
          <thead>
            <tr>
              <th>{t('componentColumnName')}</th>
              <th>{t('componentColumnPath')}</th>
              <th>{t('componentColumnRuntime')}</th>
              <th>{t('componentColumnPorts')}</th>
              <th>{t('componentLastAppliedAnalysis')}</th>
              <th>{t('componentColumnStatus')}</th>
              <th className="text-right">{t('environmentVersionColumnAction')}</th>
            </tr>
          </thead>
          <tbody>
            {applications.flatMap((application) =>
              application.services.map((service) => (
                <tr key={service.id}>
                  <td>
                    <strong className="font-semibold">{service.name}</strong>
                    {application.name.toLowerCase() !== service.name.toLowerCase() ? (
                      <span className="ml-2 text-xs text-muted-foreground">{application.name}</span>
                    ) : null}
                  </td>
                  <td className="max-w-[240px] truncate font-mono text-xs">
                    {projectComponentPath(service)}
                  </td>
                  <td>{service.runtime || service.kind || '—'}</td>
                  <td className="font-mono text-xs">{projectComponentPorts(service)}</td>
                  <td className="font-mono text-xs">{projectComponentAnalysisCommit(service)}</td>
                  <td>
                    <StatusTag
                      status={service.status}
                      label={t(getServiceStatusLabelKey(service.status))}
                    />
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className={`${PROJECT_COMPACT_ACTION_CLASS} gap-1 font-medium text-primary hover:underline`}
                      onClick={() => setSelected({ service, applicationName: application.name })}
                    >
                      {t('projectComponentViewAction')}
                      <ArrowRight
                        size={14}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </ProjectTableSurface>
      <ProjectComponentDetailsModal
        service={selected?.service ?? null}
        applicationName={selected?.applicationName ?? ''}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
