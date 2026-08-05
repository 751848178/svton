'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseOrderDetail } from '../hooks/use-release-order-detail';
import { useReleaseOrderEvidence } from '../hooks/use-release-order-evidence';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import {
  readExplicitReleaseOrderStep,
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
} from '../utils/project-route.utils';
import { ReleaseOrderDetailHeader } from './release-order-detail-header';
import { ReleaseOrderStepContent } from './release-order-step-content';
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
  const evidence = useReleaseOrderEvidence(projectId, releaseOrderId);
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const detail = ownsDetail(order.scope, order.detail, scope, props);
  const step = readReleaseOrderStep(searchParams, detail?.resumeStep || 'preflight');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const deploymentRunId = searchParams.get('deploymentRunId')?.trim() || undefined;
  const releaseRunId = searchParams.get('releaseRunId')?.trim() || undefined;
  const loadOrder = order.load;
  const loadEvidence = evidence.load;
  const refresh = useCallback(async () => {
    await Promise.all([loadOrder(), loadEvidence(), onOrdersChanged()]);
  }, [loadEvidence, loadOrder, onOrdersChanged]);
  const builds = useReleaseBuilds(projectId, releaseOrderId, refresh, Boolean(detail), 50);

  useEffect(() => {
    const incompatibleFocus =
      (step !== 'build' && Boolean(buildRunId)) ||
      (step !== 'staging' && step !== 'production' && Boolean(deploymentRunId)) ||
      (step !== 'production' && Boolean(releaseRunId));
    if (!detail || (explicitStep === step && !incompatibleFocus)) return;
    const focus =
      step === 'build'
        ? { buildRunId }
        : step === 'staging'
          ? { deploymentRunId }
          : step === 'production'
            ? { deploymentRunId, releaseRunId }
            : undefined;
    router.replace(releaseOrderHref(projectId, releaseOrderId, step, searchParams, focus), {
      scroll: false,
    });
  }, [
    buildRunId,
    deploymentRunId,
    explicitStep,
    detail,
    projectId,
    releaseOrderId,
    releaseRunId,
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
          evidence={evidence}
          step={step}
          projectId={projectId}
          releaseOrderId={releaseOrderId}
          focusedBuildRunId={buildRunId}
          focusedDeploymentRunId={deploymentRunId}
          focusedReleaseRunId={releaseRunId}
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
          onFocusStaging={(runId) =>
            router.replace(
              releaseOrderHref(projectId, releaseOrderId, 'staging', searchParams, {
                deploymentRunId: runId,
              }),
              { scroll: false },
            )
          }
          onFocusProduction={(nextReleaseRunId, nextDeploymentRunId) =>
            router.replace(
              releaseOrderHref(projectId, releaseOrderId, 'production', searchParams, {
                releaseRunId: nextReleaseRunId,
                deploymentRunId: nextDeploymentRunId,
              }),
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
