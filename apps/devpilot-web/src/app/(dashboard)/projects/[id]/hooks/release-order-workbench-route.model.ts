import {
  readExplicitReleaseOrderStep,
  releaseOrderHref,
  type ReleaseChainNode,
  type ReleaseHistoryTab,
  type ReleaseOrderFocus,
} from '../utils/project-route.utils';
import type { ReleaseWorkbenchStep } from '../components/release-workbench/release-workbench-steps.model';

export interface CanonicalReleaseWorkbenchParams {
  step: ReleaseWorkbenchStep | null;
  chain: ReleaseChainNode;
  history: ReleaseHistoryTab | null;
  focus: ReleaseOrderFocus;
}

export function canonicalReleaseWorkbenchParams(
  searchParams: URLSearchParams,
): CanonicalReleaseWorkbenchParams | null {
  const rawStep = searchParams.get('step');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = value(searchParams, 'buildRunId');
  const deploymentRunId = value(searchParams, 'deploymentRunId');
  const releaseRunId = value(searchParams, 'releaseRunId');
  const deploymentEvidence = searchParams.get('deploymentEvidence');
  const stagingStep = searchParams.get('stagingStep');
  const historyParam = searchParams.get('history');
  const history = validHistory(historyParam);
  const releaseParam = searchParams.get('release');

  if (rawStep !== null && !explicitStep) return canonicalFrom(searchParams, 'invalid');
  if (releaseParam !== null && !['production', 'staging'].includes(releaseParam)) {
    return canonicalFrom(searchParams, 'invalid');
  }
  if (historyParam !== null && !history) return canonicalFrom(searchParams, 'invalid');
  if (explicitStep === 'production' || releaseRunId)
    return canonicalFrom(searchParams, 'production');
  if (history === 'builds' && deploymentRunId) return canonicalFrom(searchParams, 'builds');
  if (history === 'deploys' && buildRunId) return canonicalFrom(searchParams, 'deploys');
  if (releaseParam === 'production' && (history || buildRunId || deploymentRunId || stagingStep)) {
    return canonicalFrom(searchParams, 'production');
  }
  if (
    stagingStep !== null &&
    (!['deploy', 'validation'].includes(stagingStep) ||
      explicitStep !== 'staging' ||
      Boolean(history))
  ) {
    return canonicalFrom(searchParams, 'invalid');
  }
  if (
    deploymentEvidence !== null &&
    (deploymentEvidence !== 'validation' || !deploymentRunId || Boolean(history))
  ) {
    return canonicalFrom(searchParams, 'deployment-evidence');
  }
  return null;
}

export function canonicalReleaseWorkbenchHref(
  canonical: CanonicalReleaseWorkbenchParams,
  projectId: string,
  releaseOrderId: string,
) {
  return releaseOrderHref(
    projectId,
    releaseOrderId,
    canonical.step,
    new URLSearchParams(),
    canonical.focus,
    canonical.chain,
    canonical.history ?? undefined,
  );
}

function canonicalFrom(
  searchParams: URLSearchParams,
  mode: string,
): CanonicalReleaseWorkbenchParams {
  const step = (readExplicitReleaseOrderStep(searchParams) as ReleaseWorkbenchStep | null) ?? null;
  const buildRunId = value(searchParams, 'buildRunId');
  const deploymentRunId = value(searchParams, 'deploymentRunId');
  const releaseRunId = value(searchParams, 'releaseRunId');
  const stagingStep = validStagingStep(searchParams.get('stagingStep'));
  const history = validHistory(searchParams.get('history'));
  if (mode === 'production') {
    return { step: null, chain: 'production', history: null, focus: { releaseRunId } };
  }
  if (mode === 'builds')
    return { step, chain: 'staging', history: 'builds', focus: { buildRunId } };
  if (mode === 'deploys') {
    return { step, chain: 'staging', history: 'deploys', focus: { deploymentRunId } };
  }
  if (mode === 'deployment-evidence') {
    return {
      step,
      chain: 'staging',
      history,
      focus: history ? {} : { deploymentRunId, ...(stagingStep ? { stagingStep } : {}) },
    };
  }
  return { step, chain: 'staging', history, focus: {} };
}

function validHistory(value: string | null): ReleaseHistoryTab | null {
  return value === 'builds' || value === 'deploys' ? value : null;
}

function validStagingStep(value: string | null) {
  return value === 'deploy' || value === 'validation' ? value : undefined;
}

function value(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() || undefined;
}
