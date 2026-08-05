'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useReleaseOrderDetail } from '../hooks/use-release-order-detail';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import {
  readExplicitReleaseOrderStep,
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
} from '../utils/project-route.utils';
import { ReleaseOrderBuildStep } from './release-order-build-step';
import { ReleaseOrderDetailHeader } from './release-order-detail-header';
import { ReleaseOrderPreflightStep } from './release-order-preflight-step';
import { ReleaseOrderProductionStep } from './release-order-production-step';
import { ReleaseOrderStagingStep } from './release-order-staging-step';
import { buildReleaseOrderStepViews } from './release-order-stepper.model';
import { ReleaseOrderStepper } from './release-order-stepper';

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
  const scope = scopedRequestIdentity(props.projectId, props.releaseOrderId);
  const detail = ownsDetail(order.scope, order.detail, scope, props);
  const step = readReleaseOrderStep(searchParams, detail?.resumeStep || 'preflight');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;

  useEffect(() => {
    if (!detail || explicitStep === step) return;
    router.replace(
      releaseOrderHref(
        props.projectId,
        props.releaseOrderId,
        step,
        searchParams,
        step === 'build' ? buildRunId : undefined,
      ),
      { scroll: false },
    );
  }, [
    buildRunId,
    explicitStep,
    detail,
    props.projectId,
    props.releaseOrderId,
    router,
    searchParams,
    step,
  ]);

  if (order.loading) return <LoadingState />;
  if (order.error || !detail) {
    return (
      <ErrorBanner
        message={order.error || t('releaseOrderDetailUnavailable')}
        onRetry={order.load}
      />
    );
  }
  const changeStep = (next: ReleaseOrderStep) =>
    router.replace(releaseOrderHref(props.projectId, props.releaseOrderId, next, searchParams), {
      scroll: false,
    });
  const refresh = async () => {
    await Promise.all([order.load(), props.onOrdersChanged()]);
  };

  return (
    <div className="space-y-5">
      <ReleaseOrderDetailHeader
        detail={detail}
        onBack={() => router.replace(releaseOrderListHref(props.projectId, searchParams))}
      />
      <ReleaseOrderStepper
        steps={buildReleaseOrderStepViews(detail)}
        selectedStep={step}
        onSelect={changeStep}
      >
        <ReleaseOrderStepContent
          detail={detail}
          step={step}
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          focusedBuildRunId={buildRunId}
          onChanged={refresh}
          onOpenBuildLog={(runId) =>
            router.replace(
              releaseOrderHref(props.projectId, props.releaseOrderId, 'build', searchParams, runId),
              { scroll: false },
            )
          }
          onCloseBuildLog={() =>
            router.replace(
              releaseOrderHref(props.projectId, props.releaseOrderId, 'build', searchParams),
              { scroll: false },
            )
          }
        />
      </ReleaseOrderStepper>
    </div>
  );
}

function ownsDetail(
  loadedScope: string | null,
  detail: ReleaseOrderDetail | null,
  expectedScope: string,
  props: Pick<Props, 'projectId' | 'releaseOrderId'>,
) {
  if (loadedScope !== expectedScope) return null;
  if (detail?.projectId !== props.projectId || detail.id !== props.releaseOrderId) return null;
  return detail;
}

interface StepContentProps {
  detail: ReleaseOrderDetail;
  step: ReleaseOrderStep;
  projectId: string;
  releaseOrderId: string;
  focusedBuildRunId?: string;
  onChanged: () => Promise<unknown>;
  onOpenBuildLog: (runId: string) => void;
  onCloseBuildLog: () => void;
}

function ReleaseOrderStepContent(props: StepContentProps) {
  if (props.step === 'preflight') return <ReleaseOrderPreflightStep detail={props.detail} />;
  if (props.step === 'build') {
    return (
      <ReleaseOrderBuildStep
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        focusedBuildRunId={props.focusedBuildRunId}
        onChanged={props.onChanged}
        onOpenLog={props.onOpenBuildLog}
        onCloseLog={props.onCloseBuildLog}
      />
    );
  }
  if (props.step === 'staging') {
    return (
      <ReleaseOrderStagingStep
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        onChanged={props.onChanged}
      />
    );
  }
  return (
    <ReleaseOrderProductionStep
      projectId={props.projectId}
      releaseOrderId={props.releaseOrderId}
      onChanged={props.onChanged}
    />
  );
}
