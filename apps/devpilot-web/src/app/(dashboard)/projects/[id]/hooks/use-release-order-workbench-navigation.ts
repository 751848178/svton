'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReleaseWorkbenchActivity } from '../components/release-workbench/release-workbench-activity.model';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import {
  deliveryHref,
  readExplicitReleaseOrderStep,
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
} from '../utils/project-route.utils';

export function useReleaseOrderWorkbenchNavigation(input: {
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = readReleaseOrderStep(searchParams, input.detail?.resumeStep || 'preflight');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const deploymentRunId = searchParams.get('deploymentRunId')?.trim() || undefined;
  const releaseRunId = searchParams.get('releaseRunId')?.trim() || undefined;

  useEffect(() => {
    const incompatibleFocus =
      (step !== 'build' && Boolean(buildRunId)) ||
      (step !== 'staging' && step !== 'production' && Boolean(deploymentRunId)) ||
      (step !== 'production' && Boolean(releaseRunId));
    if (!input.detail || (explicitStep === step && !incompatibleFocus)) return;
    const focus =
      step === 'build'
        ? { buildRunId }
        : step === 'staging'
          ? { deploymentRunId }
          : step === 'production'
            ? { deploymentRunId, releaseRunId }
            : undefined;
    router.replace(
      releaseOrderHref(input.projectId, input.releaseOrderId, step, searchParams, focus),
      { scroll: false },
    );
  }, [
    buildRunId,
    deploymentRunId,
    explicitStep,
    input.detail,
    input.projectId,
    input.releaseOrderId,
    releaseRunId,
    router,
    searchParams,
    step,
  ]);

  const replace = (nextStep: ReleaseOrderStep, focus?: Focus) =>
    router.replace(
      releaseOrderHref(input.projectId, input.releaseOrderId, nextStep, searchParams, focus),
      { scroll: false },
    );

  const openActivity = (activity: ReleaseWorkbenchActivity) => {
    if (activity.step === 'build') return replace('build', { buildRunId: activity.buildRunId });
    if (activity.step === 'staging') {
      return replace('staging', { deploymentRunId: activity.deploymentRunId });
    }
    if (activity.step === 'production') {
      return replace('production', {
        releaseRunId: activity.releaseRunId,
        deploymentRunId: activity.deploymentRunId,
      });
    }
    return replace('preflight');
  };

  return {
    searchParams,
    step,
    buildRunId,
    deploymentRunId,
    releaseRunId,
    selectStep: (next: ReleaseOrderStep) => replace(next),
    back: () => router.replace(releaseOrderListHref(input.projectId, searchParams)),
    openBuildLog: (runId: string) => replace('build', { buildRunId: runId }),
    closeBuildLog: () => replace('build'),
    focusStaging: (runId: string) => replace('staging', { deploymentRunId: runId }),
    closeStaging: () => replace('staging'),
    focusProduction: (nextReleaseRunId: string, nextDeploymentRunId?: string) =>
      replace('production', {
        releaseRunId: nextReleaseRunId,
        deploymentRunId: nextDeploymentRunId,
      }),
    closeProductionLog: () => replace('production', { releaseRunId }),
    openActivity,
    recoveryHref: deliveryHref(input.projectId, 'environment-versions', searchParams),
  };
}

type Focus =
  | string
  | { buildRunId?: string; deploymentRunId?: string; releaseRunId?: string }
  | undefined;

export type ReleaseOrderWorkbenchNavigation = ReturnType<typeof useReleaseOrderWorkbenchNavigation>;
