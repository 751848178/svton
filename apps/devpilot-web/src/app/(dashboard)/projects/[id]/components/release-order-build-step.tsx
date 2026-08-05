'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseBuildLogDrawer } from './release-build-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  focusedBuildRunId?: string;
  onChanged: () => Promise<unknown>;
  onOpenLog: (buildRunId: string) => void;
  onCloseLog: () => void;
}

export function ReleaseOrderBuildStep(props: Props) {
  const t = useTranslations('projects');
  const focusedBuildRunId = props.focusedBuildRunId;
  const onCloseLog = props.onCloseLog;
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const scope = scopedRequestIdentity(props.projectId, props.releaseOrderId);
  const ownsState = builds.scope === scope;
  const items = ownsState
    ? builds.items.filter((item) => item.releaseOrderId === props.releaseOrderId)
    : [];
  const focused = items.find((item) => item.id === focusedBuildRunId) || null;
  const loadedSuccessfully = builds.successfulScope === scope;
  const normalizedFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!focusedBuildRunId) {
      normalizedFocus.current = null;
      return;
    }
    if (focused) {
      normalizedFocus.current = null;
      return;
    }
    if (!loadedSuccessfully || normalizedFocus.current === focusedBuildRunId) return;
    normalizedFocus.current = focusedBuildRunId;
    onCloseLog();
  }, [focused, focusedBuildRunId, loadedSuccessfully, onCloseLog]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('releaseStepBuildTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('releaseStepBuildDescription')}</p>
        </div>
        <Button
          onClick={() => void builds.buildLatest()}
          loading={ownsState && builds.building}
        >
          {t('buildLatestCode')}
        </Button>
      </div>
      {ownsState && builds.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {builds.error}
        </p>
      ) : null}
      {ownsState && !builds.loading && items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('releaseBuildEmpty')}
        </p>
      ) : null}
      <div className="space-y-3">
        {items.map((run) => (
          <article
            key={run.id}
            className="rounded-md border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{t('releaseBuildRevision', { revision: run.revision })}</strong>
                  <StatusTag
                    status={releaseOrderStatusTone(run.status)}
                    label={t(`releaseBuildStatus${statusKey(run.status)}`)}
                  />
                </div>
                <p className="font-mono text-xs">
                  {run.sourceBranch}@{run.sourceCommitSha}
                </p>
                {run.sourceRepository ? (
                  <p className="break-all text-xs text-muted-foreground">
                    {t('releaseBuildIdentitySummary', {
                      provider: run.sourceRepository.provider,
                      revision: run.sourceRepository.identityRevision,
                      url: run.sourceRepository.canonicalUrl,
                    })}
                  </p>
                ) : null}
                {run.manifest ? (
                  <p className="break-all font-mono text-xs">{run.manifest.digest}</p>
                ) : null}
                {run.errorMessage ? (
                  <p className="text-destructive">
                    {run.errorCode}: {run.errorMessage}
                  </p>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.onOpenLog(run.id)}
              >
                {t('viewReleaseBuildLogs')}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <ReleaseBuildLogDrawer
        run={focused}
        onClose={props.onCloseLog}
      />
    </div>
  );
}

function statusKey(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
