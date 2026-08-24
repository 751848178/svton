'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type { ReleaseBuildItem } from '../types/release-order.types';
import {
  buildErrorText,
  shortDigest,
  shortTechnicalId,
} from '../utils/release-display.utils';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseBuildStatusLabelKey, releaseBuildStatusTone } from './release-build-view.model';
import { ReleaseOrderActions } from './release-order-actions';
import { ReleaseScrollTable } from './release-workbench/release-scroll-table';

interface Props {
  items: ReleaseBuildItem[];
  onOpenLog: (buildRunId: string) => void;
}

/**
 * PX-5：去掉固定 min-width，列内容短 ID 化（#N 为主、cuid 折叠、digest 短哈希），
 * 表格在抽屉内自适应收缩，操作列不再被裁出视口。
 */
export function ReleaseBuildHistoryTable({ items, onOpenLog }: Props) {
  const t = useTranslations('projects');
  return (
    <ReleaseScrollTable>
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">{t('releaseBuildHistoryTable')}</caption>
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[15%]" />
          <col className="w-[30%]" />
          <col className="w-[17%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-muted/50 text-left">
          <tr>
            <Header>{t('releaseBuildColumnBuild')}</Header>
            <Header>{t('releaseBuildColumnCommit')}</Header>
            <Header>{t('releaseBuildColumnResult')}</Header>
            <Header>{t('releaseBuildColumnManifest')}</Header>
            <Header>{t('releaseBuildColumnDurationTime')}</Header>
            <Header className="text-right">{t('releaseBuildColumnActions')}</Header>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((run) => (
            <tr
              key={run.id}
              data-build-run-id={run.id}
            >
              <Cell>
                <strong className="block truncate font-semibold">
                  {t('releaseBuildRevision', { revision: run.revision })}
                </strong>
                <code
                  className="block truncate text-xs text-muted-foreground"
                  title={run.id}
                >
                  {shortTechnicalId(run.id)}
                </code>
              </Cell>
              <Cell>
                <span className="block truncate text-xs text-muted-foreground">{run.sourceBranch}</span>
                <code
                  className="block truncate text-xs"
                  title={run.sourceCommitSha}
                >
                  {run.sourceCommitSha.slice(0, 8)}
                </code>
              </Cell>
              <Cell>
                <FlowStatusTag
                  status={releaseBuildStatusTone(run.status)}
                  label={t(releaseBuildStatusLabelKey(run.status))}
                />
                {run.errorCode ? (
                  <span
                    className="mt-1 block truncate text-xs text-red-700"
                    title={`${run.errorCode}: ${run.errorMessage || t('releaseBuildUnavailable')}`}
                  >
                    {buildErrorText(run.errorCode, run.errorMessage, t('releaseBuildUnavailable'))}
                  </span>
                ) : null}
              </Cell>
                <Cell>
                  {run.manifest ? (
                    <code
                      className="block truncate text-xs"
                      title={`${run.manifest.id} · ${run.manifest.digest}`}
                    >
                      {shortDigest(run.manifest.digest)}
                    </code>
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
                <Cell className="text-right">
                  {/* 操作列与项目列表一致：ReleaseOrderActions（文字链接 + 溢出菜单）。 */}
                  <ReleaseOrderActions
                    actions={[
                      {
                        key: 'log',
                        label: t('viewReleaseBuildLogs'),
                        onSelect: () => onOpenLog(run.id),
                      },
                    ]}
                    moreLabel={t('releaseOrderMoreActions')}
                  />
                </Cell>
              </tr>
            ))}
        </tbody>
      </table>
    </ReleaseScrollTable>
  );
}

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return <th scope="col" className={`px-3 py-3 font-medium ${className ?? ''}`}>{children}</th>;
}

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
