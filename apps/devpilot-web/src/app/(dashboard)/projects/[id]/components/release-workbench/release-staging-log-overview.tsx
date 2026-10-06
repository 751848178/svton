'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseRunStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import {
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import { ReleaseDeploymentEvidenceLink } from '../release-deployment-evidence-link';
import { FlowStatusTag } from './release-flow-status-tag';
import { releaseStagingFailureSummary } from './release-staging-failure.model';
import { ReleaseStagingFailureNotice } from './release-staging-failure-notice';

export function ReleaseStagingLogOverview(props: {
  projectId: string;
  run: ReleaseStagingDeploymentItem;
  build: ReleaseBuildItem | null;
}) {
  const t = useTranslations('projects');
  const technical = stagingTechnicalConclusion(props.run);
  const business = stagingBusinessConclusion(props.run);
  const failure = releaseStagingFailureSummary(props.run.error);

  return (
    <div className="space-y-5">
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

      <dl className="grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-3">
        <Fact
          label={t('releaseStagingSourceBuild')}
          value={props.build ? t('releaseBuildRevision', { revision: props.build.revision }) : '—'}
        />
        <Fact
          label={t('releaseBuildStartedAt')}
          value={formatIso(props.run.startedAt)}
        />
        <Fact
          label={t('releaseBuildFinishedAt')}
          value={formatIso(props.run.finishedAt)}
        />
      </dl>

      <section aria-labelledby="release-staging-conclusions-title">
        <h4
          id="release-staging-conclusions-title"
          className="text-sm font-semibold"
        >
          {t('releaseStagingConclusionTitle')}
        </h4>
        <div className="mt-3 divide-y border-y">
          <Conclusion
            title={t('releaseStagingTechnicalResult')}
            detail={t('releaseStagingTechnicalResultDetail')}
            conclusion={technical}
          />
          <Conclusion
            title={t('releaseStagingBusinessResult')}
            detail={t('releaseStagingBusinessResultDetail')}
            conclusion={business}
          />
        </div>
      </section>

      <ReleaseDeploymentEvidenceLink
        projectId={props.projectId}
        runId={props.run.id}
      />
    </div>
  );
}

function Conclusion(props: {
  title: string;
  detail: string;
  conclusion: ReturnType<typeof stagingTechnicalConclusion>;
}) {
  const t = useTranslations('projects');
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium">{props.title}</p>
      <p className="text-xs text-muted-foreground">{props.detail}</p>
      <FlowStatusTag
        status={props.conclusion.tone}
        label={t(props.conclusion.key)}
      />
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className="mt-1 truncate font-medium"
        title={props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
