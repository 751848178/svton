'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { buildErrorText } from '../../utils/release-display.utils';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import { releaseBuildLogSummary } from '../release-build-log.model';
import { releaseBuildStatusLabelKey, releaseBuildStatusTone } from '../release-build-view.model';
import { FlowStatusTag } from './release-flow-status-tag';

interface Props {
  run: ReleaseBuildItem | null;
  requestedBuildRunId?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
}

export function ReleaseBasicBuildLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const summary = releaseBuildLogSummary(props.run?.logSummary);
  return (
    <Drawer
      open={Boolean(props.run || props.requestedBuildRunId)}
      onClose={props.onClose}
      title={
        props.run
          ? t('releaseBuildLogTitle', { revision: props.run.revision })
          : t('releaseBuildLogs')
      }
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
      bodyClassName="flex flex-col overflow-hidden"
    >
      {props.loading ? <LoadingState text={t('releaseBuildDetailLoading')} /> : null}
      {props.error ? (
        <ErrorBanner
          message={props.error}
          onRetry={props.onRetry}
        />
      ) : null}
      {props.run ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <FlowStatusTag
              status={releaseBuildStatusTone(props.run.status)}
              label={t(releaseBuildStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')} ·{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) ||
                t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          <RunTimes
            startedAt={props.run.startedAt}
            finishedAt={props.run.finishedAt}
          />
          {props.run.errorCode ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {buildErrorText(
                props.run.errorCode,
                props.run.errorMessage,
                t('releaseBuildUnavailable'),
              )}
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
          >
            {summary.lines.length ? summary.lines.join('\n') : t('releaseBuildLogsEmpty')}
          </pre>
        </div>
      ) : null}
    </Drawer>
  );
}

function RunTimes(props: { startedAt: string | null; finishedAt: string | null }) {
  const t = useTranslations('projects');
  return (
    <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted-foreground">{t('releaseBuildStartedAt')}</dt>
        <dd className="mt-1 font-medium">{formatIso(props.startedAt)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{t('releaseBuildFinishedAt')}</dt>
        <dd className="mt-1 font-medium">{formatIso(props.finishedAt)}</dd>
      </div>
    </dl>
  );
}
