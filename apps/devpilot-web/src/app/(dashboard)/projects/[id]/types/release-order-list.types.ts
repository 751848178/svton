import type {
  ReleaseOrderLifecycle,
  ReleaseOrderLifecycleStatus,
  ReleaseOrderPersistedStatus,
} from './release-order-lifecycle.types';
import type { ReleaseEnvironmentRole, ReleaseExecutionStatus } from './release-copy.types';

export type ReleaseOrderListStatus = ReleaseOrderLifecycleStatus;

export interface ReleaseOrderListItem {
  id: string;
  projectId: string;
  releaseVersion: string;
  releaseName?: string | null;
  note: string | null;
  persistedStatus: ReleaseOrderPersistedStatus;
  lifecycle: ReleaseOrderLifecycle;
  createdAt: string;
  source: {
    branch: string | null;
    commitSha: string | null;
    buildRunId: string | null;
    buildRevision: number | null;
    buildStatus: string | null;
  };
  build: {
    count: number;
    recentSuccessfulManifest: null | {
      id: string;
      digest: string;
      buildRunId: string;
      buildRevision: number;
      createdAt: string;
    };
  };
  deployment: {
    count: number;
    latest: null | {
      id: string;
      environmentId: string;
      environmentRole: ReleaseEnvironmentRole;
      environmentName: string;
      status: ReleaseExecutionStatus;
      artifactManifestId: string;
      buildRunId: string;
      occurredAt: string;
    };
  };
  lastExecution: {
    step: 'preflight' | 'build' | 'staging' | 'production';
    sourceType: 'order_created' | 'build_run' | 'deployment_run' | 'release_run';
    sourceId: string;
    status: ReleaseExecutionStatus;
    occurredAt: string;
  };
  lastExecutedAt: string;
}

export interface ReleaseOrderListResponse {
  scope: { actorId: string; teamId: string; projectId: string };
  items: ReleaseOrderListItem[];
  total: number;
}
