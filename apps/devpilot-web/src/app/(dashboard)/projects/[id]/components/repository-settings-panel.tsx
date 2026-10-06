'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { settingsHref } from '../utils/project-route.utils';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';
import { RepositoryConnectCard } from './repository-connect-card';

export function RepositorySettingsPanel(props: {
  analysis: RepositoryAnalysisHook;
  onRunCreated: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const searchParams = useSearchParams();
  return (
    <section aria-labelledby="repository-settings-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="repository-settings-title"
            className="text-base font-semibold"
          >
            {t('repositorySettingsTitle')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('repositorySettingsDescription')}
          </p>
        </div>
        <Link
          href={settingsHref(props.analysis.projectId, 'environments', searchParams)}
          className={`${PROJECT_COMPACT_ACTION_CLASS} gap-1 font-medium text-primary hover:underline`}
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          {t('repositorySettingsBackToEnvironment')}
        </Link>
      </div>
      <div className="mt-5">
        <RepositoryConnectCard
          analysis={props.analysis}
          onRunCreated={props.onRunCreated}
        />
      </div>
    </section>
  );
}
