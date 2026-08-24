import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseWorkbenchStep } from './release-workbench/release-workbench-steps.model';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';

export interface DetailHook {
  scope: string | null;
  detail: ReleaseOrderDetail | null;
  loading: boolean;
  error: string;
  load: () => Promise<unknown>;
}

export interface WorkbenchProps {
  detail: { counts: { releaseRuns: number } };
  navigation: {
    release: 'staging' | 'production';
    step: ReleaseWorkbenchStep;
    selectStep: (step: ReleaseWorkbenchStep) => void;
    selectRelease: (node: 'staging' | 'production') => void;
  };
  onBuildLatest: () => void;
}

export function detailHook(
  resumeStep: ReleaseOrderStep,
  load: () => Promise<unknown>,
  releaseOrderId = 'order-1',
  releaseRuns = 1,
): DetailHook {
  return {
    scope: scopedRequestIdentity('project-1', releaseOrderId),
    detail: detail(resumeStep, releaseOrderId, releaseRuns),
    loading: false,
    error: '',
    load,
  };
}

function detail(
  resumeStep: ReleaseOrderStep,
  releaseOrderId: string,
  releaseRuns: number,
): ReleaseOrderDetail {
  return {
    id: releaseOrderId,
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
    counts: { buildRuns: 1, manifests: 1, releaseRuns },
    persistedStatus: 'active',
    lifecycle: {
      status: 'production',
      phase: 'production',
      sourceType: 'release_run',
      sourceId: 'release-1',
      sourceStatus: 'running',
      occurredAt: '2026-08-05T01:00:00.000Z',
    },
    resumeStep,
    preflight: {
      ready: true,
      repository: {
        ready: true,
        branch: 'main',
        identityRevisionId: 'r1',
        identityRevision: 1,
      },
      staging: { ready: true },
      production: { ready: true },
    },
  };
}
