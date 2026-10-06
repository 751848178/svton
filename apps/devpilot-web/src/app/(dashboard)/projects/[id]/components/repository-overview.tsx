'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';

export function RepositoryOverview({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const t = useTranslations('projects');
  const connection = analysis.state.connection;
  const identity = analysis.state.canonicalIdentity;
  const url = identity?.canonicalUrl || connection?.repositoryUrl;
  const branch =
    identity?.effectiveRevision?.defaultBranch ||
    connection?.defaultBranch ||
    connection?.selectedBranch;

  return (
    <section aria-label={t('repositoryOverviewTitle')}>
      {!connection && !identity ? (
        <p className="text-sm text-muted-foreground">
          {analysis.loading ? t('repositoryAnalysisLoading') : t('repositoryAnalysisNotConnected')}
        </p>
      ) : (
        <dl className="grid min-w-0 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label={t('repositoryOverviewAddress')}
            value={url || '—'}
            className="sm:col-span-2"
            breakAll
          />
          <Fact
            label={t('repositoryOverviewDefaultBranch')}
            value={branch || '—'}
          />
          <Fact
            label={t('repositoryConnectionVerifiedAt')}
            value={connection?.verifiedAt ? formatDateTimeMinute(connection.verifiedAt) : '—'}
          />
        </dl>
      )}
    </section>
  );
}

function Fact(props: {
  label: string;
  value: string;
  title?: string;
  className?: string;
  breakAll?: boolean;
}) {
  return (
    <div className={`min-w-0 ${props.className || ''}`}>
      <dt className="text-xs font-medium text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-1 text-sm leading-5 ${props.breakAll ? 'break-all' : 'break-words'}`}
        title={props.title}
      >
        {props.value}
      </dd>
    </div>
  );
}
