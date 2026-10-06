import type { ReleaseOrderStep } from '../types/release-order.types';
import { buildProjectRoute } from './project-route-query.utils';
import { projectReleaseDetailPath } from './project-release-route.model';

export type ReleaseOrderFocus = Partial<
  Record<
    'buildRunId' | 'deploymentRunId' | 'releaseRunId' | 'deploymentEvidence' | 'stagingStep',
    string
  >
>;
export type ReleaseChainNode = 'staging' | 'production';
export type ReleaseHistoryTab = 'builds' | 'deploys';

export function readReleaseOrderStep(
  searchParams: URLSearchParams,
  fallback: ReleaseOrderStep,
): ReleaseOrderStep {
  return readExplicitReleaseOrderStep(searchParams) || fallback;
}

export function readExplicitReleaseOrderStep(searchParams: URLSearchParams) {
  const steps = searchParams.getAll('step');
  if (steps.length !== 1) return null;
  const step = steps[0];
  return ['preflight', 'build', 'staging', 'production'].includes(step || '')
    ? (step as ReleaseOrderStep)
    : null;
}

export function releaseOrderHref(
  projectId: string,
  releaseOrderId: string,
  step: ReleaseOrderStep | null,
  searchParams: URLSearchParams,
  focus?: string | ReleaseOrderFocus,
  chain: ReleaseChainNode = 'staging',
  history?: ReleaseHistoryTab,
) {
  const next = new URLSearchParams(searchParams);
  [
    'tab',
    'view',
    'section',
    'runId',
    'analysisRunId',
    'environmentId',
    'env',
    'envTab',
    'releasePlanId',
    'stageId',
    'releaseOrderId',
  ].forEach((key) => next.delete(key));

  if (chain === 'production' || step === 'production') {
    next.set('release', 'production');
    [
      'step',
      'history',
      'buildRunId',
      'deploymentRunId',
      'deploymentEvidence',
      'stagingStep',
    ].forEach((key) => next.delete(key));
    const requested = typeof focus === 'string' ? {} : focus;
    if (requested?.releaseRunId) next.set('releaseRunId', requested.releaseRunId);
    else next.delete('releaseRunId');
  } else {
    next.delete('release');
    if (step) next.set('step', step);
    else next.delete('step');
    next.delete('releaseRunId');
    const requested = typeof focus === 'string' ? { buildRunId: focus } : focus;
    next.delete('buildRunId');
    if (requested?.buildRunId) next.set('buildRunId', requested.buildRunId);
    next.delete('deploymentRunId');
    if (requested?.deploymentRunId) next.set('deploymentRunId', requested.deploymentRunId);
    next.delete('deploymentEvidence');
    if (requested?.deploymentRunId && requested.deploymentEvidence === 'validation') {
      next.set('deploymentEvidence', 'validation');
    }
    next.delete('stagingStep');
    const requestedStagingStep = requested?.stagingStep;
    if (
      step === 'staging' &&
      (requestedStagingStep === 'deploy' || requestedStagingStep === 'validation')
    ) {
      next.set('stagingStep', requestedStagingStep);
    }
    next.delete('history');
    if (history) next.set('history', history);
  }

  return buildProjectRoute(projectReleaseDetailPath(projectId, releaseOrderId), next);
}

export function releaseOrderListHref(projectId: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  [
    'releaseOrderId',
    'step',
    'buildRunId',
    'deploymentRunId',
    'deploymentEvidence',
    'stagingStep',
    'releaseRunId',
    'env',
    'envTab',
  ].forEach((key) => next.delete(key));
  return buildProjectRoute(`/projects/${encodeURIComponent(projectId)}`, next);
}

export function deploymentRunHref(
  projectId: string,
  deploymentRunId: string,
  releaseOrderId?: string,
) {
  const next = new URLSearchParams({ deploymentRunId });
  const path = releaseOrderId
    ? projectReleaseDetailPath(projectId, releaseOrderId)
    : `/projects/${encodeURIComponent(projectId)}/deployments`;
  return buildProjectRoute(path, next);
}
