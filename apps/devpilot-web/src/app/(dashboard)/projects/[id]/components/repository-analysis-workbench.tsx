'use client';

import React from 'react';
import Link from 'next/link';
import { GearSix } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';
import { RepositoryRunPanel } from './repository-run-panel';
import { RepositorySuggestionReview } from './repository-suggestion-review';

export function RepositoryAnalysisWorkbench({
  analysis,
  settingsHref,
  onSelectRun,
}: {
  analysis: RepositoryAnalysisHook;
  settingsHref: string;
  onSelectRun: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const connected = analysis.state.connection?.status === 'connected';
  const start = async () => {
    const run = await analysis.start();
    onSelectRun(run.id);
  };

  return (
    <section
      className="min-w-0 space-y-5"
      aria-labelledby="repository-analysis-page-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="repository-analysis-page-title"
            className="text-lg font-semibold tracking-[-0.02em]"
          >
            {t('repositoryAnalysisPageTitle')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t('repositoryAnalysisPageDescription')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {connected ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={analysis.active || analysis.mutating}
              onClick={() => void start().catch(() => undefined)}
            >
              {t('repositoryAnalysisStartCurrent')}
            </Button>
          ) : null}
          <Link
            href={settingsHref}
            className={`${PROJECT_COMPACT_ACTION_CLASS} gap-1 font-medium text-primary hover:underline`}
          >
            <GearSix
              size={15}
              aria-hidden="true"
            />
            {t('repositoryAnalysisManageSettings')}
          </Link>
        </div>
      </div>
      {analysis.error ? (
        <ErrorBanner
          message={analysis.error}
          onRetry={() => void analysis.load()}
          retryLabel={t('repositoryAnalysisRetryLoad')}
        />
      ) : null}
      <RepositoryRunPanel
        analysis={analysis}
        onSelectRun={onSelectRun}
      />
      <RepositorySuggestionReview analysis={analysis} />
    </section>
  );
}
