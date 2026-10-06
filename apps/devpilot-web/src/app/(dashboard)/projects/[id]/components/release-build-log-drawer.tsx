'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { buildErrorText, shortDigest } from '../utils/release-display.utils';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseBuildStatusLabelKey, releaseBuildStatusTone } from './release-build-view.model';
import {
  releaseBuildCommitLabel,
  releaseBuildLogSummary,
  releaseBuildTechnicalItems,
} from './release-build-log.model';
import { ReleaseManifestEvidence, ReleaseManifestRawEvidence } from './release-manifest-evidence';
import { ReleaseTechnicalDetails } from './release-technical-details';

interface Props {
  run: ReleaseBuildItem | null;
  requestedBuildRunId?: string;
  /** applicationId → 组件名；用于把制品 componentKey 翻译成人读名称。 */
  componentNames?: Record<string, string>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
}

/**
 * 两层信息结构：主层保留人做判断的关键事实（结论 / Commit / 时间 /
 * 短 digest / 人读制品清单）；BuildRun ID、仓库内部字段、日志引用、
 * 完整 digest 与制品原始 URI 收进默认收起的「技术详情」。
 * PX-3：ID/摘要短哈希 + title 全文；PX-11 耗时分隔符统一「·」；
 * PX-27 创建时间与开始时间相同时不重复展示。
 */
export function ReleaseBuildLogDrawer({
  run,
  requestedBuildRunId,
  componentNames,
  loading,
  error,
  onRetry,
  onClose,
}: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const summary = releaseBuildLogSummary(run?.logSummary);
  const createdAtEqualsStarted = run
    ? formatIso(run.createdAt) === formatIso(run.startedAt)
    : false;
  const technical = run ? releaseBuildTechnicalItems(run, createdAtEqualsStarted, t) : [];

  return (
    <Drawer
      open={Boolean(run || requestedBuildRunId)}
      onClose={onClose}
      title={run ? t('releaseBuildLogTitle', { revision: run.revision }) : t('releaseBuildLogs')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
      /* 单层滚动：字段区固定，日志区是抽屉内唯一滚动层。 */
      bodyClassName="flex flex-col overflow-hidden"
    >
      {loading ? <LoadingState text={t('releaseBuildDetailLoading')} /> : null}
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={onRetry}
        />
      ) : null}
      {run ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <FlowStatusTag
              status={releaseBuildStatusTone(run.status)}
              label={t(releaseBuildStatusLabelKey(run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildRevision', { revision: run.revision })} ·{' '}
              {formatDuration(run.startedAt, run.finishedAt) || t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Evidence
              label={t('releaseBuildCommit')}
              value={releaseBuildCommitLabel(run)}
              title={run.sourceCommitSha || undefined}
            />
            <Evidence
              label={t('releaseBuildManifestDigest')}
              value={shortDigest(run.manifest?.digest)}
              title={run.manifest?.digest}
            />
            <Evidence
              label={t('releaseBuildStartedAt')}
              value={formatIso(run.startedAt)}
            />
            <Evidence
              label={t('releaseBuildFinishedAt')}
              value={formatIso(run.finishedAt)}
            />
          </dl>
          <ReleaseManifestEvidence
            manifest={run.manifest}
            componentNames={componentNames}
          />
          <ReleaseTechnicalDetails items={technical}>
            <ReleaseManifestRawEvidence manifest={run.manifest} />
          </ReleaseTechnicalDetails>
          {run.errorCode ? (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              title={`${run.errorCode}: ${run.errorMessage || t('releaseBuildUnavailable')}`}
            >
              {buildErrorText(run.errorCode, run.errorMessage, t('releaseBuildUnavailable'))}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {summary.redacted ? t('releaseBuildLogsRedacted') : t('releaseBuildLogsUnavailable')}
          </p>
          {summary.truncated ? (
            <p className="text-xs text-muted-foreground">
              {t('releaseBuildLogsTruncated', {
                shown: summary.lineCount,
                total: summary.sourceLineCount,
              })}
            </p>
          ) : null}
          <pre
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs"
            role="log"
            aria-label={t('releaseBuildLogTitle', { revision: run.revision })}
          >
            {summary.lines.length ? summary.lines.join('\n') : t('releaseBuildLogsEmpty')}
          </pre>
        </div>
      ) : null}
    </Drawer>
  );
}

function Evidence({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className="break-all font-mono"
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}
