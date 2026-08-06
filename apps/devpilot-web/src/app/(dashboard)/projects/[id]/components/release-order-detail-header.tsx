'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Hammer } from '@phosphor-icons/react';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { releaseOrderStatusLabelKey } from '../utils/release-copy.model';
import { releaseOrderFailureLabelKey, releaseOrderStatusTone } from '../utils/release-order.utils';
import { releaseOrderStepLabelKey } from './release-order-stepper.model';

interface Props {
  detail: ReleaseOrderDetail;
  building: boolean;
  onBack: () => void;
  onBuildLatest: () => void;
}

export function ReleaseOrderDetailHeader({ detail, building, onBack, onBuildLatest }: Props) {
  const t = useTranslations('projects');
  const failureLabelKey = releaseOrderFailureLabelKey(detail.lifecycle.failureKind);
  const branch = detail.preflight.repository.branch || t('releaseOrderBranchUnavailable');
  const latestStep = t(releaseOrderStepLabelKey(detail.lifecycle.phase));
  const productionArtifactFrozen = detail.counts.releaseRuns > 0;
  const frozenReasonId = useId();

  return (
    <header className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
      >
        {t('backToReleaseOrders')}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-semibold tracking-[-0.35px]">
              {t('releaseOrderDetailHeading', { version: detail.releaseVersion })}
            </h2>
            <StatusTag
              status={releaseOrderStatusTone(detail.lifecycle.status)}
              label={t(releaseOrderStatusLabelKey(detail.lifecycle.status))}
            />
            {productionArtifactFrozen ? (
              <StatusTag
                status="completed"
                label={t('releaseProductionArtifactFrozen')}
              />
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
            <span>{t('releaseOrderIdentityMeta', { orderId: detail.id })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('releaseOrderVersionMeta', { version: detail.releaseVersion })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('releaseOrderBranchMeta', { branch })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('releaseOrderLatestStepMeta', { step: latestStep })}</span>
          </p>
          {detail.note ? <p className="mt-1 text-xs text-slate-500">{detail.note}</p> : null}
          {failureLabelKey ? (
            <p className="mt-1 text-xs text-destructive">{t(failureLabelKey)}</p>
          ) : null}
        </div>
        <Button
          loading={building}
          disabled={productionArtifactFrozen}
          aria-describedby={productionArtifactFrozen ? frozenReasonId : undefined}
          title={productionArtifactFrozen ? t('releaseBuildFrozenReason') : undefined}
          onClick={onBuildLatest}
        >
          <Hammer
            size={18}
            weight="bold"
            aria-hidden="true"
          />
          {t('buildLatestCode')}
        </Button>
        {productionArtifactFrozen ? (
          <span
            id={frozenReasonId}
            className="sr-only"
          >
            {t('releaseBuildFrozenReason')}
          </span>
        ) : null}
      </div>
    </header>
  );
}
