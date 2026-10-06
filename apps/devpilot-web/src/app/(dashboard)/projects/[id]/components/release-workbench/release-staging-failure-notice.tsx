'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { releaseStagingFailureSummary } from './release-staging-failure.model';

export function ReleaseStagingFailureNotice(props: {
  failure: NonNullable<ReturnType<typeof releaseStagingFailureSummary>>;
}) {
  const t = useTranslations('projects');
  const workload = props.failure.kind === 'workload-start';
  const service = props.failure.kind === 'workload-start' ? props.failure.service : '—';
  return (
    <div
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      role="alert"
    >
      <p className="text-sm font-semibold text-destructive">
        {t(workload ? 'releaseStagingFailureWorkloadTitle' : 'releaseStagingFailureGenericTitle')}
      </p>
      <p className="mt-1 text-sm text-foreground">
        {workload
          ? t('releaseStagingFailureWorkloadDescription', { service })
          : t('releaseStagingFailureGenericDescription')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t('releaseStagingFailureImpact')}</p>
    </div>
  );
}
