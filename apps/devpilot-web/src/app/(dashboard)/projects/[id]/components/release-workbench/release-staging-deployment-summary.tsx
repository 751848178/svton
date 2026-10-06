'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseRunStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { releaseStagingFailureSummary } from './release-staging-failure.model';
import { ReleaseStagingFailureNotice } from './release-staging-failure-notice';

interface Props {
  basic?: boolean;
  deployment: ReleaseStagingDeploymentItem;
  build: ReleaseBuildItem | null;
  stagingEnvironment: { id: string; name: string } | null;
  showEvidenceHint?: boolean;
  onOpenLog: (runId: string) => void;
}

export function ReleaseStagingDeploymentSummary(props: Props) {
  const t = useTranslations('projects');
  const { deployment } = props;
  const empty = t('releaseWorkbenchValueEmpty');
  const environment =
    props.stagingEnvironment?.id === deployment.environmentId
      ? props.stagingEnvironment.name
      : deployment.environmentId || empty;
  const failure = releaseStagingFailureSummary(deployment.error);

  return (
    <section
      className="space-y-4"
      aria-labelledby="release-staging-run-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FlowStatusTag
          status={releaseOrderStatusTone(deployment.status)}
          label={t(releaseRunStatusLabelKey(deployment.status))}
        />
        <h4
          id="release-staging-run-title"
          className="text-sm font-semibold"
        >
          {t(props.basic ? 'releaseBasicCurrentDeployment' : 'releaseStagingCurrentRun')}
        </h4>
        <Button
          className="ml-auto"
          variant="ghost"
          size="sm"
          onClick={() => props.onOpenLog(deployment.id)}
        >
          {t('viewReleaseLogs')}
        </Button>
      </div>

      {failure ? <ReleaseStagingFailureNotice failure={failure} /> : null}

      <dl
        className={
          props.basic
            ? 'grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-3'
            : 'grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-4'
        }
      >
        <Fact
          label={t('releaseStagingEnvironment')}
          value={environment}
        />
        {!props.basic ? (
          <Fact
            label={t('releaseStagingSummaryBuild')}
            value={
              props.build ? t('releaseBuildRevision', { revision: props.build.revision }) : empty
            }
          />
        ) : null}
        <Fact
          label={t('releaseBuildDuration')}
          value={formatDuration(deployment.startedAt, deployment.finishedAt) || empty}
        />
        <Fact
          label={t('releaseBuildFinishedAt')}
          value={formatIso(deployment.finishedAt)}
        />
      </dl>
      {props.showEvidenceHint !== false ? (
        <p className="text-xs text-muted-foreground">{t('releaseStagingEvidenceMovedHint')}</p>
      ) : null}
    </section>
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
