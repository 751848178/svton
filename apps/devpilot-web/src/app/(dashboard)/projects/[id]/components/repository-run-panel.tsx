'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { Select } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import {
  repositoryRunStatusClass,
  repositoryRunStatusLabel,
} from './repository-analysis-status.model';
import { RepositoryRunDetail } from './repository-run-detail';

export function RepositoryRunPanel({
  analysis,
  onSelectRun,
}: {
  analysis: RepositoryAnalysisHook;
  onSelectRun: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  if (analysis.loading) return <LoadingState text="正在加载解析记录…" />;
  if (analysis.runs.length === 0) return <EmptyState text={t('repositoryNoRuns')} />;
  const run = analysis.selectedRun;
  return (
    <section>
      <label className="mb-4 block lg:hidden">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('repositoryAnalysisRunPickerLabel')}
        </span>
        <Select
          className="h-11 w-full"
          value={run?.id || ''}
          onChange={(event) => onSelectRun(event.target.value)}
          options={analysis.runs.map((item) => ({
            value: item.id,
            label: `${repositoryRunStatusLabel(item.status)} · ${item.branch}@${item.commitSha.slice(0, 8)} · ${formatDateTimeMinute(item.createdAt)}`,
          }))}
        />
      </label>
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="hidden min-w-0 border-r pr-5 lg:block">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {t('repositoryAnalysisHistoryTitle')}
          </h4>
          <ul className="mt-2 max-h-[28rem] divide-y overflow-y-auto border-y">
            {analysis.runs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`min-h-14 w-full border-l px-2 py-3 text-left text-sm hover:bg-muted/30 ${
                    item.id === run?.id ? 'border-primary bg-primary/5' : 'border-transparent'
                  }`}
                  aria-current={item.id === run?.id ? 'true' : undefined}
                  onClick={() => onSelectRun(item.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${repositoryRunStatusClass(item.status)}`}>
                      {repositoryRunStatusLabel(item.status)}
                    </span>
                    <span className="font-mono text-xs">{item.commitSha.slice(0, 8)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.branch} · {formatDateTimeMinute(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {run ? (
          <RepositoryRunDetail
            analysis={analysis}
            run={run}
          />
        ) : null}
      </div>
    </section>
  );
}
