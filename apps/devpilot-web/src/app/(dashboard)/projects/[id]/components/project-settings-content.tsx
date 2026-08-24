'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../hooks/use-project-detail';
import { ProjectContextIssue } from './project-context-issue';
import { EnvironmentSettingsArea } from './settings/environment-settings-area';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectSettingsContent({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const project = detail.project;
  if (!project) return null;
  const production = project.environments?.find(
    (environment) => environment.baselineRole === 'production',
  );
  const hasProductionEntry = Boolean(
    production && project.sites?.some((site) => site.environment?.id === production.id),
  );
  return (
    <div className="space-y-6">
      {!hasProductionEntry ? (
        <ProjectContextIssue
          message={t('productionEntryMissing')}
          actionLabel={t('configureProductionEntry')}
          href={`/projects/${encodeURIComponent(project.id)}/domains?environmentId=${encodeURIComponent(production?.id ?? '')}`}
        />
      ) : null}
      <EnvironmentSettingsArea detail={detail} />
    </div>
  );
}
