'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { type ReleaseBuildsController, useReleaseBuilds } from '../hooks/use-release-builds';
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
  const { projectId, releaseOrderId, onOrdersChanged } = props;
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const order = useReleaseOrderDetail(projectId, releaseOrderId);
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const detail = ownsDetail(order.scope, order.detail, scope, props);
  const step = readReleaseOrderStep(searchParams, detail?.resumeStep || 'preflight');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const loadOrder = order.load;
  const refresh = useCallback(async () => {
    await Promise.all([loadOrder(), onOrdersChanged()]);
  }, [loadOrder, onOrdersChanged]);
  const builds = useReleaseBuilds(projectId, releaseOrderId, refresh, Boolean(detail), 50);

  useEffect(() => {
    if (!detail || explicitStep === step) return;
    router.replace(
      releaseOrderHref(
        projectId,
        releaseOrderId,
        step,
        searchParams,
        step === 'build' ? buildRunId : undefined,
      ),
      { scroll: false },
    );
  }, [buildRunId, explicitStep, detail, projectId, releaseOrderId, router, searchParams, step]);

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
    router.replace(releaseOrderHref(projectId, releaseOrderId, next, searchParams), {
      scroll: false,
    });
  const triggerBuild = () => {
    changeStep('build');
    void builds.buildLatest();
  };

  return (
    <div className="space-y-5">
      <ReleaseOrderDetailHeader
        detail={detail}
        building={builds.building}
        onBack={() => router.replace(releaseOrderListHref(projectId, searchParams))}
        onBuildLatest={triggerBuild}
      />
      <ReleaseOrderStepper
        steps={buildReleaseOrderStepViews(detail)}
        selectedStep={step}
        onSelect={changeStep}
      >
        <ReleaseOrderStepContent
          detail={detail}
          builds={builds}
          step={step}
          projectId={projectId}
          releaseOrderId={releaseOrderId}
          focusedBuildRunId={buildRunId}
          onChanged={refresh}
          onOpenBuildLog={(runId) =>
            router.replace(
              releaseOrderHref(projectId, releaseOrderId, 'build', searchParams, runId),
              { scroll: false },
            )
          }
          onCloseBuildLog={() =>
            router.replace(releaseOrderHref(projectId, releaseOrderId, 'build', searchParams), {
              scroll: false,
            })
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
  builds: ReleaseBuildsController;
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
        builds={props.builds}
        focusedBuildRunId={props.focusedBuildRunId}
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
