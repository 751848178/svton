'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { buildErrorText } from '../../utils/release-display.utils';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import {
  isReleaseBuildActive,
  releaseBuildStatusLabelKey,
  releaseBuildStatusTone,
} from '../release-build-view.model';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseBasicBuildPanel(props: {
  build: ReleaseBuildItem | null;
  building: boolean;
  onOpenLog: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const build = props.build;
  if (!build) {
    return (
      <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t('releaseBasicBuildEmpty')}
      </p>
    );
  }
  const duration = formatDuration(build.startedAt, build.finishedAt);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FlowStatusTag
          status={releaseBuildStatusTone(build.status)}
          label={t(releaseBuildStatusLabelKey(build.status))}
        />
        <strong className="text-sm">
          {t('releaseBasicBuildRevision', { revision: build.revision })}
        </strong>
        <span className="text-xs text-muted-foreground">
          {duration || t('releaseWorkbenchValueEmpty')}
        </span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="sm"
          loading={props.building}
          onClick={() => props.onOpenLog(build.id)}
        >
          {t('viewReleaseLogs')}
        </Button>
      </div>
      <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <Fact
          label={t('releaseBuildStartedAt')}
          value={formatIso(build.startedAt)}
        />
        <Fact
          label={t('releaseBuildFinishedAt')}
          value={
            isReleaseBuildActive(build.status)
              ? t('releaseBuildRunningFinished')
              : formatIso(build.finishedAt)
          }
        />
        <Fact
          label={t('releaseBuildDuration')}
          value={duration || t('releaseWorkbenchValueEmpty')}
        />
      </dl>
      {build.errorCode ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {buildErrorText(build.errorCode, build.errorMessage, t('releaseBuildUnavailable'))}
        </p>
      ) : null}
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className="mt-1 truncate"
        title={props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
