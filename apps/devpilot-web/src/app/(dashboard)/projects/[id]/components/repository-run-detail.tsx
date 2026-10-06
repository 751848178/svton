'use client';

import React from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type {
  RepositoryAnalysisRun,
  RepositoryAnalysisStage,
} from '../types/repository-analysis.types';
import {
  repositoryRunStatusClass,
  repositoryRunStatusLabel,
  repositoryStageLabel,
} from './repository-analysis-status.model';

export function RepositoryRunDetail({
  analysis,
  run,
}: {
  analysis: RepositoryAnalysisHook;
  run: RepositoryAnalysisRun;
}) {
  const t = useTranslations('projects');
  const active = run.status === 'queued' || run.status === 'running';
  return (
    <section
      className="min-w-0"
      aria-labelledby={`repository-run-${run.id}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={`repository-run-${run.id}-title`}
            className="text-sm font-semibold"
          >
            {t('repositoryAnalysisSelectedRunTitle')}
          </h3>
          <p
            className="mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
            title={`${run.branch}@${run.commitSha}`}
          >
            {run.branch}@{run.commitSha}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTimeMinute(run.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`flex min-h-9 items-center text-sm font-medium ${repositoryRunStatusClass(run.status)}`}
          >
            {repositoryRunStatusLabel(run.status)}
          </span>
          {active ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={analysis.mutating}
              onClick={() => void analysis.cancel(run.id)}
            >
              取消本次解析
            </Button>
          ) : null}
          {run.status === 'failed' || run.status === 'cancelled' ? (
            <Button
              size="sm"
              disabled={analysis.mutating}
              onClick={() => void analysis.retry(run.id)}
            >
              重试本次解析
            </Button>
          ) : null}
        </div>
      </div>
      {run.errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{run.errorMessage}</p>
          {run.errorAction ? <p className="mt-1 text-muted-foreground">{run.errorAction}</p> : null}
          {run.errorCode ? <code className="mt-2 block text-xs">{run.errorCode}</code> : null}
        </div>
      ) : null}
      <h4 className="mt-5 text-xs font-semibold text-muted-foreground">
        {t('repositoryAnalysisStagesTitle')}
      </h4>
      <ol className="mt-4 divide-y border-y">
        {(run.stages || []).map((stage) => (
          <StageRow
            key={stage.id}
            stage={stage}
          />
        ))}
      </ol>
      {run.warnings?.length ? (
        <ul className="mt-4 list-disc pl-5 text-sm text-amber-700">
          {run.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const EVIDENCE_PAGE_SIZE = 20;

function StageRow({ stage }: { stage: RepositoryAnalysisStage }) {
  const t = useTranslations('projects');
  const evidence = Array.isArray(stage.evidence) ? stage.evidence : [];
  const logs = Array.isArray(stage.logs) ? stage.logs : [];
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, EVIDENCE_PAGE_SIZE);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{repositoryStageLabel(stage.name)}</span>
        <span className={`text-xs ${repositoryRunStatusClass(stage.status)}`}>
          {repositoryRunStatusLabel(stage.status)}
          {stage.durationMs != null ? ` · ${stage.durationMs}ms` : ''}
        </span>
      </div>
      {logs.length ? (
        <details className="mt-2 text-xs">
          <summary className="min-h-9 cursor-pointer content-center text-primary">
            {t('repositoryAnalysisLogsSummary', { count: logs.length })}
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border-y bg-muted/20 px-3 py-2 font-mono text-xs leading-5">
            {logs.map(String).join('\n')}
          </pre>
        </details>
      ) : null}
      {stage.errorMessage ? (
        <p className="mt-1 text-sm text-destructive">{stage.errorMessage}</p>
      ) : null}
      {evidence.length ? (
        <details className="mt-2 text-xs">
          <summary className="min-h-9 cursor-pointer content-center text-primary">
            查看 {evidence.length} 条证据
          </summary>
          <ul className="mt-2 max-h-56 divide-y overflow-auto border-y">
            {visibleEvidence.map((item, index) => (
              <li
                key={`${item.file}-${index}`}
                className="break-words py-2 font-mono leading-5"
              >
                {item.file} · {item.detail}
              </li>
            ))}
          </ul>
          {evidence.length > EVIDENCE_PAGE_SIZE ? (
            <button
              type="button"
              className="mt-2 min-h-9 rounded px-2 text-primary hover:bg-muted/50"
              onClick={() => setShowAllEvidence((value) => !value)}
              aria-expanded={showAllEvidence}
            >
              {showAllEvidence
                ? `收起（仅展示前 ${EVIDENCE_PAGE_SIZE} 条）`
                : `仅展示前 ${EVIDENCE_PAGE_SIZE} 条，展开全部 ${evidence.length} 条`}
            </button>
          ) : null}
        </details>
      ) : null}
    </li>
  );
}
