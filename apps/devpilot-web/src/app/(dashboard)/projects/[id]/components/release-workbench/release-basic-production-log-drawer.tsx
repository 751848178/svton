'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseBasicProductionLogDrawer(props: {
  run: ReleaseEvidenceProductionRun | null;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const deployment = latestDeployment(props.run);
  return (
    <Drawer
      open={Boolean(props.run)}
      onClose={props.onClose}
      title={t('releaseBasicProductionLogsTitle')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
      bodyClassName="flex flex-col overflow-hidden"
    >
      {props.run ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <FlowStatusTag
              status={releaseOrderStatusTone(props.run.status)}
              label={t(releaseExecutionStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')} ·{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) ||
                t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
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
          {props.run.errorCode || props.run.errorMessage ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {[props.run.errorCode, props.run.errorMessage].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <pre
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs"
            role="log"
          >
            {deployment?.logs.length
              ? deployment.logs.join('\n')
              : t('releaseBasicProductionLogsEmpty')}
          </pre>
        </div>
      ) : null}
    </Drawer>
  );
}

function latestDeployment(run: ReleaseEvidenceProductionRun | null) {
  return run
    ? ([...run.deploymentRuns].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )[0] ?? null)
    : null;
}

function Time(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 font-medium">{props.value}</dd>
    </div>
  );
}
