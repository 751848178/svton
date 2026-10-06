'use client';

import React, { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { ErrorBanner } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { RepositoryOverview } from './repository-overview';

export function ProjectRepositoryDetails(props: { analysis: RepositoryAnalysisHook }) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState(false);
  const panelId = 'project-repository-details-panel';
  const hasKnownData = Boolean(
    props.analysis.state.connection || props.analysis.state.canonicalIdentity,
  );
  return (
    <section
      className="min-w-0"
      aria-labelledby="project-repository-details-title"
    >
      <h2 id="project-repository-details-title">
        <button
          type="button"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[15px] font-semibold tracking-[-0.015em] outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
        >
          {t('projectRepositoryDetailsTitle')}
          <CaretDown
            size={16}
            className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      {expanded ? (
        <div
          id={panelId}
          className="mt-2"
        >
          {props.analysis.error ? (
            <ErrorBanner
              message={props.analysis.error}
              onRetry={() => void props.analysis.load()}
              retryLabel={t('repositoryAnalysisRetryLoad')}
            />
          ) : null}
          {!props.analysis.error || hasKnownData ? (
            <div className={props.analysis.error ? 'mt-4' : undefined}>
              <RepositoryOverview analysis={props.analysis} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
