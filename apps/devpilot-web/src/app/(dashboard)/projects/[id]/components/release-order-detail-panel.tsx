'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, Tabs } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { useReleaseOrderDetail } from '../hooks/use-release-order-detail';
import type { ReleaseOrderStep } from '../types/release-order.types';
import {
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
} from '../utils/project-route.utils';
import { releaseOrderFailureLabelKey, releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseOrderBuildStep } from './release-order-build-step';
import { ReleaseOrderPreflightStep } from './release-order-preflight-step';
import { ReleaseOrderStagingStep } from './release-order-staging-step';
import { ReleaseOrderProductionStep } from './release-order-production-step';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onOrdersChanged: () => Promise<unknown>;
}

export function ReleaseOrderDetailPanel(props: Props) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const order = useReleaseOrderDetail(props.projectId, props.releaseOrderId);
  const step = readReleaseOrderStep(searchParams, order.detail?.resumeStep || 'preflight');
  const rawStep = searchParams.get('step');

  useEffect(() => {
    if (!order.detail || rawStep === step) return;
    router.replace(releaseOrderHref(props.projectId, props.releaseOrderId, step, searchParams), {
      scroll: false,
    });
  }, [order.detail, props.projectId, props.releaseOrderId, rawStep, router, searchParams, step]);

  if (order.loading) return <LoadingState />;
  if (order.error || !order.detail) {
    return (
      <ErrorBanner
        message={order.error || t('releaseOrderDetailUnavailable')}
        onRetry={order.load}
      />
    );
  }
  const detail = order.detail;
  const failureLabelKey = releaseOrderFailureLabelKey(detail.lifecycle.failureKind);
  const changeStep = (next: string) =>
    router.replace(
      releaseOrderHref(
        props.projectId,
        props.releaseOrderId,
        next as ReleaseOrderStep,
        searchParams,
      ),
      { scroll: false },
    );
  const refresh = async () => {
    await Promise.all([order.load(), props.onOrdersChanged()]);
  };
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace(releaseOrderListHref(props.projectId, searchParams))}
          >
            {t('backToReleaseOrders')}
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{detail.releaseVersion}</h2>
            <StatusTag
              status={releaseOrderStatusTone(detail.lifecycle.status)}
              label={t(`releaseOrderStatus${statusKey(detail.lifecycle.status)}`)}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.note || t('releaseOrderNoNote')}
          </p>
          {failureLabelKey && (
            <p className="mt-1 text-xs text-destructive">{t(failureLabelKey)}</p>
          )}
        </div>
      </div>
      <Tabs
        activeKey={step}
        onChange={changeStep}
        items={[
          {
            key: 'preflight',
            label: t('releaseStepPreflight'),
            children: <ReleaseOrderPreflightStep detail={detail} />,
          },
          {
            key: 'build',
            label: t('releaseStepBuild'),
            children: (
              <ReleaseOrderBuildStep
                projectId={props.projectId}
                releaseOrderId={props.releaseOrderId}
                focusedBuildRunId={buildRunId}
                onChanged={refresh}
                onOpenLog={(runId) =>
                  router.replace(
                    releaseOrderHref(
                      props.projectId,
                      props.releaseOrderId,
                      'build',
                      searchParams,
                      runId,
                    ),
                    { scroll: false },
                  )
                }
                onCloseLog={() =>
                  router.replace(
                    releaseOrderHref(props.projectId, props.releaseOrderId, 'build', searchParams),
                    { scroll: false },
                  )
                }
              />
            ),
          },
          {
            key: 'staging',
            label: t('releaseStepStaging'),
            children: (
              <ReleaseOrderStagingStep
                projectId={props.projectId}
                releaseOrderId={props.releaseOrderId}
                onChanged={refresh}
              />
            ),
          },
          {
            key: 'production',
            label: t('releaseStepProduction'),
            children: (
              <ReleaseOrderProductionStep
                projectId={props.projectId}
                releaseOrderId={props.releaseOrderId}
                onChanged={refresh}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function statusKey(status: string) {
  return status
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}
