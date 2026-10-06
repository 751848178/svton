'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { useProductionReleases } from '../../hooks/use-production-releases';
import { ProductionConfirmModal } from '../../publish/components/production-confirm-modal';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import {
  productionConfirmBlocker,
  productionRunNeedsPolling,
} from '../../utils/release-production-run.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { latestProductionRun } from './release-round.model';
import { releaseProductionViewState } from './release-production-view.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  manifestBuild: ReleaseBuildItem | null;
  stagingDeployment: ReleaseStagingDeploymentItem | null;
  productionRuns: ReleaseEvidenceProductionRun[];
  onChanged: () => Promise<unknown>;
  onOpenLog: (runId: string) => void;
}

export function ReleaseBasicProductionStage(props: Props) {
  const t = useTranslations('projects');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const frozen = props.productionRuns.length > 0;
  const manifestId = props.manifestBuild?.manifest?.id || '';
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
    !frozen && Boolean(manifestId),
    true,
  );
  const latest = useMemo(() => latestProductionRun(props.productionRuns), [props.productionRuns]);
  const blocker = productionConfirmBlocker(production.preview);
  const { publishDisabled, publishDisabledReason } = releaseProductionViewState(
    {
      manifestId,
      loading: production.loading,
      previewAvailable: Boolean(production.preview),
      previewError: production.errorKind === 'load' ? production.error : '',
      confirmBlocker: blocker,
      stagingProof: props.stagingDeployment,
    },
    t,
  );

  useEffect(() => {
    if (!productionRunNeedsPolling(latest)) return;
    const timer = window.setInterval(() => void props.onChanged(), 5_000);
    return () => window.clearInterval(timer);
  }, [latest, props.onChanged]);

  if (!manifestId && !latest) {
    return (
      <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t('releaseRoundProductionWaitingNeutral')}
      </p>
    );
  }
  if (latest) {
    const duration = formatDuration(latest.startedAt, latest.finishedAt);
    const running = productionRunNeedsPolling(latest);
    const completed = latest.status.toLowerCase() === 'succeeded';
    const actionLabel = completed
      ? t('releaseBasicDeployedAction')
      : running
        ? t('releaseBasicDeployingAction')
        : t('releaseBasicProductionAction');
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FlowStatusTag
            status={releaseOrderStatusTone(latest.status)}
            label={t(releaseExecutionStatusLabelKey(latest.status))}
          />
          <span className="text-xs text-muted-foreground">
            {duration || t('releaseWorkbenchValueEmpty')}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onOpenLog(latest.id)}
            >
              {t('viewProductionLogs')}
            </Button>
            <Button
              size="sm"
              loading={running}
              disabled
              aria-describedby="release-basic-production-action-context"
            >
              {actionLabel}
            </Button>
          </div>
        </div>
        <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <Fact
            label={t('releaseBuildStartedAt')}
            value={formatIso(latest.startedAt)}
          />
          <Fact
            label={t('releaseBuildFinishedAt')}
            value={formatIso(latest.finishedAt)}
          />
        </dl>
        {latest.errorCode || latest.errorMessage ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {[latest.errorCode, latest.errorMessage].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <p
          id="release-basic-production-action-context"
          className="text-sm text-muted-foreground"
        >
          {completed
            ? t('releaseBasicProductionCompleted')
            : running
              ? t('releaseBasicProductionRunning')
              : t('releaseBasicProductionReuse')}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('releaseBasicProductionReady')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('releaseBasicProductionReuse')}</p>
        </div>
        <Button
          loading={production.loading}
          disabled={publishDisabled}
          onClick={() => setConfirmOpen(true)}
        >
          {t('releaseBasicProductionAction')}
        </Button>
      </div>
      {publishDisabledReason ? (
        <p className="text-xs text-muted-foreground">{publishDisabledReason}</p>
      ) : null}
      {production.errorKind === 'action' && production.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {production.error}
        </p>
      ) : null}
      <ProductionConfirmModal
        basic
        open={confirmOpen}
        loading={production.loading && !production.preview}
        confirming={production.confirming}
        error={production.errorKind === 'action' ? production.error : ''}
        loadError={production.errorKind === 'load' ? production.error : ''}
        preview={production.preview}
        onClose={() => setConfirmOpen(false)}
        onConfirm={production.confirm}
      />
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 font-medium">{props.value}</dd>
    </div>
  );
}
