'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { ErrorBanner } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { RepositoryRunStatus } from '../types/repository-analysis.types';
import { repositoryRunStatusClass } from './repository-analysis-status.model';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';

const STATUS_KEYS = {
  queued: 'repositoryRunStatusQueued',
  running: 'repositoryRunStatusRunning',
  succeeded: 'repositoryRunStatusSucceeded',
  failed: 'repositoryRunStatusFailed',
  cancelled: 'repositoryRunStatusCancelled',
} as const satisfies Record<RepositoryRunStatus, string>;

export function ProjectComponentAnalysisOverview(props: {
  analysis: RepositoryAnalysisHook;
  analysisHref: string;
}) {
  const t = useTranslations('projects');
  const listRun = props.analysis.runs[0];
  const run = props.analysis.selectedRun?.id === listRun?.id ? props.analysis.selectedRun : listRun;
  const componentSuggestions = run?.suggestions?.filter(
    (suggestion) => suggestion.kind === 'application_service',
  );
  const pendingCount = componentSuggestions?.filter(
    (suggestion) => suggestion.status === 'pending',
  ).length;

  return (
    <section
      className="mb-4 min-w-0"
      aria-labelledby="project-component-analysis-title"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3
            id="project-component-analysis-title"
            className="text-sm font-semibold"
          >
            {t('projectComponentAnalysisTitle')}
          </h3>
          <Link
            href={props.analysisHref}
            className={`${PROJECT_COMPACT_ACTION_CLASS} gap-1 font-medium text-primary hover:underline`}
          >
            {t('projectComponentAnalysisViewFull')}
            <ArrowRight
              size={15}
              aria-hidden="true"
            />
          </Link>
        </div>
        {run ? (
          <div className="mt-1 min-w-0 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`font-medium ${repositoryRunStatusClass(run.status)}`}>
                {t(STATUS_KEYS[run.status])}
              </span>
              <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                {run.branch}@{run.commitSha.slice(0, 12)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(
                  run.finishedAt ? 'repositoryAnalysisFinishedAt' : 'repositoryAnalysisCreatedAt',
                  {
                    time: formatDateTimeMinute(run.finishedAt || run.createdAt),
                  },
                )}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {componentSuggestions
                ? t('projectComponentAnalysisResult', {
                    count: componentSuggestions.length,
                    pending: pendingCount ?? 0,
                  })
                : t('projectComponentAnalysisResultUnavailable')}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {props.analysis.loading
              ? t('repositoryAnalysisLoading')
              : props.analysis.state.connection?.status === 'connected'
                ? t('repositoryAnalysisConnectedNoRuns')
                : t('repositoryAnalysisNotConnected')}
          </p>
        )}
      </div>
      {props.analysis.error ? (
        <div className="mt-3">
          <ErrorBanner
            message={props.analysis.error}
            onRetry={() => void props.analysis.load()}
            retryLabel={t('repositoryAnalysisRetryLoad')}
          />
        </div>
      ) : null}
    </section>
  );
}
