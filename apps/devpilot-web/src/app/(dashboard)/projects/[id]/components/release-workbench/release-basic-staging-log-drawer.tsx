'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { releaseRunStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { stagingLogDisplay } from '../release-staging-log.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { releaseStagingFailureSummary } from './release-staging-failure.model';
import { ReleaseStagingFailureNotice } from './release-staging-failure-notice';

interface Props {
  run: ReleaseStagingDeploymentItem | null;
  requestedRunId?: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ReleaseBasicStagingLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const failure = releaseStagingFailureSummary(props.run?.error);
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseStagingExecutionLogs')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
      bodyClassName="flex flex-col overflow-hidden"
    >
      {props.loading ? <LoadingState text={t('releaseStagingDetailLoading')} /> : null}
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
              status={releaseOrderStatusTone(props.run.status)}
              label={t(releaseRunStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')} ·{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) ||
                t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          {failure ? <ReleaseStagingFailureNotice failure={failure} /> : null}
          <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2">
            <Time
              label={t('releaseBuildStartedAt')}
              value={formatIso(props.run.startedAt)}
            />
            <Time
              label={t('releaseBuildFinishedAt')}
              value={formatIso(props.run.finishedAt)}
            />
          </dl>
          <pre
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs"
            role="log"
          >
            {stagingLogDisplay(props.run.logs, t('releaseStagingLogsEmpty'))}
          </pre>
        </div>
      ) : null}
    </Drawer>
  );
}

function Time(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 font-medium">{props.value}</dd>
    </div>
  );
}
