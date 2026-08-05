'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseBuildStatusLabelKey, releaseBuildStatusTone } from './release-build-view.model';

interface Props {
  items: ReleaseBuildItem[];
  onOpenLog: (buildRunId: string) => void;
}

export function ReleaseBuildHistoryTable({ items, onOpenLog }: Props) {
  const t = useTranslations('projects');
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] table-fixed text-sm">
        <caption className="sr-only">{t('releaseBuildHistoryTable')}</caption>
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="bg-muted/50 text-left">
          <tr>
            <Header>{t('releaseBuildColumnBuild')}</Header>
            <Header>{t('releaseBuildColumnCommit')}</Header>
            <Header>{t('releaseBuildColumnResult')}</Header>
            <Header>{t('releaseBuildColumnManifest')}</Header>
            <Header>{t('releaseBuildColumnDurationTime')}</Header>
            <Header>{t('releaseBuildColumnActions')}</Header>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((run) => (
            <tr
              key={run.id}
              data-build-run-id={run.id}
            >
              <Cell>
                <code
                  className="block truncate font-semibold"
                  title={run.id}
                >
                  {run.id}
                </code>
                <span className="block text-xs text-muted-foreground">
                  {t('releaseBuildRevision', { revision: run.revision })}
                </span>
              </Cell>
              <Cell>
                <span className="block text-xs text-muted-foreground">{run.sourceBranch}</span>
                <code
                  className="block truncate text-xs"
                  title={run.sourceCommitSha}
                >
                  {run.sourceCommitSha.slice(0, 12)}
                </code>
              </Cell>
              <Cell>
                <StatusTag
                  status={releaseBuildStatusTone(run.status)}
                  label={t(releaseBuildStatusLabelKey(run.status))}
                />
                {run.errorCode ? (
                  <span
                    className="mt-1 block truncate text-xs text-destructive"
                    title={`${run.errorCode}: ${run.errorMessage || t('releaseBuildUnavailable')}`}
                  >
                    {run.errorCode}: {run.errorMessage || t('releaseBuildUnavailable')}
                  </span>
                ) : null}
              </Cell>
              <Cell>
                {run.manifest ? (
                  <>
                    <code
                      className="block truncate text-xs"
                      title={run.manifest.id}
                    >
                      {run.manifest.id}
                    </code>
                    <code
                      className="block truncate text-xs text-muted-foreground"
                      title={run.manifest.digest}
                    >
                      {run.manifest.digest}
                    </code>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Cell>
              <Cell>
                <span className="block">
                  {formatDuration(run.startedAt, run.finishedAt) || '—'}
                </span>
                <time
                  className="block truncate text-xs text-muted-foreground"
                  dateTime={run.createdAt}
                  title={formatIso(run.createdAt)}
                >
                  {formatIso(run.createdAt)}
                </time>
              </Cell>
              <Cell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenLog(run.id)}
                >
                  {t('viewReleaseBuildLogs')}
                </Button>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Header({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
