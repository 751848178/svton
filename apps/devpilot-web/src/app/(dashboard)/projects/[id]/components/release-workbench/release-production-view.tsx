/** 生产发布节点：复用预发制品，并将机器证据保留在详情层。 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui';
import { ProductionConfirmModal } from '../../publish/components/production-confirm-modal';
import { useProductionReleases } from '../../hooks/use-production-releases';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import type { ReleaseStagingValidationEvidence } from '../../utils/release-staging-view.model';
import {
  productionConfirmBlocker,
  productionRunNeedsPolling,
} from '../../utils/release-production-run.model';
import { latestProductionRun } from './release-round.model';
import { ReleaseProductionCurrentRun } from './release-production-current-run';
import { ReleaseProductionHistoryDrawer } from './release-production-history-drawer';
import { ReleaseProductionPreviewPanel } from './release-production-preview-panel';
import { ReleaseProductionRunLogDrawer } from './release-production-run-log-drawer';
import { releaseProductionViewState } from './release-production-view.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  /** 生产发布制品：已有生产运行 → 冻结制品；否则最新预发验证通过的制品。 */
  manifestBuild: ReleaseBuildItem | null;
  stagingProof: ReleaseStagingValidationEvidence | null;
  productionRuns: ReleaseEvidenceProductionRun[];
  stagingProven: boolean;
  onChanged: () => Promise<unknown>;
  environmentHref: string;
  focusedRunId?: string;
  onFocusRun: (runId: string) => void;
  onCloseRunLog: () => void;
}

export function ReleaseProductionView(props: Props) {
  const t = useTranslations('projects');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const frozen = props.productionRuns.length > 0;
  const manifestId = props.manifestBuild?.manifest?.id || '';
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
    !frozen && Boolean(manifestId),
  );
  const latest = useMemo(() => latestProductionRun(props.productionRuns), [props.productionRuns]);
  const focused = props.productionRuns.find((run) => run.id === props.focusedRunId) ?? null;
  const confirmBlocker = productionConfirmBlocker(production.preview);
  const { publishDisabled, publishDisabledReason, stagingProofCopy } = releaseProductionViewState(
    {
      manifestId,
      loading: production.loading,
      previewAvailable: Boolean(production.preview),
      previewError: production.errorKind === 'load' ? production.error : '',
      confirmBlocker,
      stagingProof: props.stagingProof,
    },
    t,
  );

  useEffect(() => {
    if (!productionRunNeedsPolling(latest)) return;
    const timer = window.setInterval(() => void props.onChanged(), 5_000);
    return () => window.clearInterval(timer);
  }, [latest, props.onChanged]);

  return (
    <section
      className="min-w-0 space-y-5"
      aria-labelledby="release-production-view-title"
    >
      <div>
        <h3
          id="release-production-view-title"
          className="font-semibold"
        >
          {t('releaseChainNodeProduction')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{stagingProofCopy}</p>
      </div>

      {!props.stagingProven && !frozen ? (
        <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t('releaseRoundProductionWaitingNeutral')}
        </p>
      ) : latest ? (
        <ReleaseProductionCurrentRun
          run={latest}
          environmentHref={props.environmentHref}
          onOpenLog={() => props.onFocusRun(latest.id)}
        />
      ) : (
        <ReleaseProductionPreviewPanel
          preview={production.preview}
          loading={production.loading}
          error={production.errorKind === 'load' ? production.error : ''}
          confirming={production.confirming}
          disabledReason={publishDisabled ? publishDisabledReason : ''}
          environmentHref={props.environmentHref}
          onConfirm={() => setConfirmOpen(true)}
        />
      )}

      {props.productionRuns.length > 0 ? (
        <div className="flex justify-end border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <ClockCounterClockwise
              size={15}
              aria-hidden="true"
            />
            {t('releaseProductionViewHistory')}
          </Button>
        </div>
      ) : null}

      <ProductionConfirmModal
        open={confirmOpen}
        loading={production.loading && !production.preview}
        confirming={production.confirming}
        error={production.errorKind === 'action' ? production.error : ''}
        loadError={production.errorKind === 'load' ? production.error : ''}
        preview={production.preview}
        onClose={() => setConfirmOpen(false)}
        onConfirm={production.confirm}
      />
      <ReleaseProductionHistoryDrawer
        open={historyOpen}
        runs={props.productionRuns}
        focusedRunId={props.focusedRunId}
        onOpenLog={props.onFocusRun}
        onClose={() => setHistoryOpen(false)}
      />
      <ReleaseProductionRunLogDrawer
        run={focused}
        onClose={props.onCloseRunLog}
      />
    </section>
  );
}
