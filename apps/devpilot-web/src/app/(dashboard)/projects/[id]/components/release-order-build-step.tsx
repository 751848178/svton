'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Button, EmptyState, ErrorBanner } from '@/components/ui';
import type { ReleaseBuildsController } from '../hooks/use-release-builds';
import { useReleaseBuildDetail } from '../hooks/use-release-build-detail';
import { ReleaseBuildHistoryTable } from './release-build-history-table';
import { ReleaseBuildLogDrawer } from './release-build-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  builds: ReleaseBuildsController;
  focusedBuildRunId?: string;
  onOpenLog: (buildRunId: string) => void;
  onCloseLog: () => void;
  buildGate?: { allowed: boolean; reason: string };
  repairHref?: string;
  decisionShown?: boolean;
}

export function ReleaseOrderBuildStep(props: Props) {
  const t = useTranslations('projects');
  const focusedBuildRunId = props.focusedBuildRunId;
  const onCloseLog = props.onCloseLog;
  const builds = props.builds;
  const items = builds.items.filter((item) => item.releaseOrderId === props.releaseOrderId);
  const focusedSummary = items.find((item) => item.id === focusedBuildRunId) || null;
  const focusedDetail = useReleaseBuildDetail(
    props.projectId,
    props.releaseOrderId,
    focusedBuildRunId,
    focusedSummary,
  );
  const focused = focusedDetail.run;
  const loadedSuccessfully = builds.loadedSuccessfully;
  const normalizedFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!focusedBuildRunId) {
      normalizedFocus.current = null;
      return;
    }
    if (focused || focusedDetail.error) {
      normalizedFocus.current = null;
      return;
    }
    if (
      !loadedSuccessfully ||
      !focusedDetail.notFound ||
      normalizedFocus.current === focusedBuildRunId
    )
      return;
    normalizedFocus.current = focusedBuildRunId;
    onCloseLog();
  }, [
    focused,
    focusedBuildRunId,
    focusedDetail.error,
    focusedDetail.notFound,
    loadedSuccessfully,
    onCloseLog,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t('releaseStepBuildTitle')}</h3>
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {t('releaseStepBuildLatestCommitBadge')}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('releaseStepBuildDescription')}</p>
      </div>
      {builds.error ? (
        <ErrorBanner
          message={builds.error}
          onRetry={builds.load}
        />
      ) : null}
      {builds.loading && items.length === 0 ? (
        <LoadingState text={t('releaseBuildLoading')} />
      ) : null}
      {loadedSuccessfully && !builds.loading && items.length === 0 ? (
        <EmptyState
          title={t('releaseBuildEmpty')}
          action={props.decisionShown ? undefined : (
            <Button
              size="sm"
              variant="outline"
              disabled={props.buildGate?.allowed === false}
              title={props.buildGate?.reason || undefined}
              onClick={() => void builds.buildLatest()}
            >
              {t('buildLatestCode')}
            </Button>
          )}
        />
      ) : null}
      {props.buildGate?.allowed === false && !props.decisionShown ? (
        <p
          role="alert"
          className="text-sm text-amber-800"
        >
          {props.buildGate.reason}{' '}
          {props.repairHref ? (
            <a
              className="font-medium underline"
              href={props.repairHref}
            >
              {t('releaseGateRepairAction')}
            </a>
          ) : null}
        </p>
      ) : null}
      {items.length > 0 ? (
        <>
          {builds.total > items.length ? (
            <p className="text-xs text-muted-foreground">
              {t('releaseBuildHistoryLimited', { shown: items.length, total: builds.total })}
            </p>
          ) : null}
          <ReleaseBuildHistoryTable
            items={items}
            onOpenLog={props.onOpenLog}
          />
        </>
      ) : null}
      <ReleaseBuildLogDrawer
        run={focused}
        requestedBuildRunId={focusedBuildRunId}
        loading={Boolean(focusedBuildRunId) && !focusedDetail.loaded}
        error={focusedDetail.error}
        onRetry={focusedDetail.retry}
        onClose={props.onCloseLog}
      />
    </div>
  );
}
