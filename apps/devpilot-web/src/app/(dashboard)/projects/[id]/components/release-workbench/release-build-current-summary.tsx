'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import {
  isReleaseBuildActive,
  releaseBuildStatusLabelKey,
  releaseBuildStatusTone,
} from '../release-build-view.model';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseBuildCurrentSummary(props: {
  build: ReleaseBuildItem;
  building: boolean;
  manifestItemsLoaded: boolean;
  onOpenLog: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const { build } = props;
  const duration = formatDuration(build.startedAt, build.finishedAt);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FlowStatusTag
          status={releaseBuildStatusTone(build.status)}
          label={t(releaseBuildStatusLabelKey(build.status))}
        />
        <strong className="text-sm">
          {t('releaseBuildRevision', { revision: build.revision })}
        </strong>
        <span className="text-xs text-muted-foreground">
          {duration || t('releaseWorkbenchValueEmpty')}
        </span>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          loading={props.building}
          onClick={() => props.onOpenLog(build.id)}
        >
          {t('viewReleaseLogs')}
        </Button>
      </div>
      <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          label={t('releaseBuildCommit')}
          value={`${build.sourceBranch} @ ${build.sourceCommitSha}`}
          mono
        />
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
      {build.manifest ? (
        <section
          className="rounded-lg border p-4"
          aria-labelledby="release-build-manifest-title"
        >
          <h4
            id="release-build-manifest-title"
            className="text-sm font-semibold"
          >
            {t('releaseBuildManifestSummary')}
          </h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <Fact
              label={t('releaseBuildManifestId')}
              value={build.manifest.id}
              mono
            />
            <Fact
              label={t('releaseBuildManifestDigest')}
              value={build.manifest.digest}
              mono
            />
            <Fact
              label={t('releaseBuildArtifactCount')}
              value={
                props.manifestItemsLoaded
                  ? t('releaseBuildArtifactCountValue', { count: build.manifest.items.length })
                  : t('releaseWorkbenchValueEmpty')
              }
            />
          </dl>
        </section>
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          {t('releaseBuildManifestUnavailable')}
        </p>
      )}
    </div>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-1 break-all ${props.mono ? 'font-mono text-xs' : ''}`}
        title={props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
