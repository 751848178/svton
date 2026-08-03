'use client';

import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { releaseOrderStatusTone } from '../utils/release-order.utils';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
}

export function ReleaseOrderBuildSummary({
  projectId,
  releaseOrderId,
  onChanged,
}: Props) {
  const t = useTranslations('projects');
  const builds = useReleaseBuilds(projectId, releaseOrderId, onChanged);
  const latest = builds.items[0];

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {!builds.loading && !latest ? (
            <span className="text-muted-foreground">{t('releaseBuildEmpty')}</span>
          ) : null}
          {latest ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusTag
                status={releaseOrderStatusTone(latest.status)}
                label={t(`releaseBuildStatus${statusKey(latest.status)}`)}
              />
              <span>{t('releaseBuildRevision', { revision: latest.revision })}</span>
              <code title={latest.sourceCommitSha}>{latest.sourceCommitSha.slice(0, 12)}</code>
              {latest.manifest ? (
                <code title={latest.manifest.digest}>{latest.manifest.digest.slice(0, 19)}…</code>
              ) : null}
            </div>
          ) : null}
          {latest?.errorMessage ? (
            <p className="mt-2 text-destructive" role="alert">
              {latest.errorCode}: {latest.errorMessage}
            </p>
          ) : null}
          {builds.error ? <p className="mt-2 text-destructive" role="alert">{builds.error}</p> : null}
        </div>
        <Button
          size="sm"
          onClick={() => void builds.buildLatest()}
          loading={builds.building}
          disabled={builds.loading}
        >
          {t('buildLatestCode')}
        </Button>
      </div>
    </div>
  );
}

function statusKey(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
