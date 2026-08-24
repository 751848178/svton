import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import type {
  ReleaseOrderLifecycle,
  ReleaseOrderLifecyclePhase,
  ReleaseOrderPersistedStatus,
} from "./release-order-lifecycle.types";

interface DetailRecord {
  id: string;
  projectId: string;
  releaseVersion: string;
  releaseName?: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { buildRuns: number; manifests: number; releaseRuns: number };
  project: {
    repositoryConnection: {
      repositoryUrl: string;
      provider: string;
      status: string;
      defaultBranch: string | null;
      selectedBranch: string | null;
    } | null;
    repositoryIdentity: {
      id: string;
      projectId: string;
      provider: string;
      canonicalKey: string;
      canonicalUrl: string;
      lockedAt: Date | null;
      currentRevision: {
        id: string;
        revision: number;
        defaultBranch: string;
        reason: string;
        createdAt: Date;
        identityId: string;
        projectId: string;
      } | null;
    } | null;
    environments: Array<{ id: string; baselineRole: string | null }>;
  };
}

export function presentReleaseOrderDetail(input: {
  order: DetailRecord;
  persistedStatus: ReleaseOrderPersistedStatus;
  lifecycle: ReleaseOrderLifecycle;
  resumeStep: ReleaseOrderLifecyclePhase;
}) {
  const { order } = input;
  const baselineRoles = new Set(
    order.project.environments.map((environment) => environment.baselineRole),
  );
  const repositoryReady = isStoredConnectionAligned(
    order.project.repositoryIdentity,
    order.project.repositoryConnection,
  );
  return {
    id: order.id,
    projectId: order.projectId,
    releaseVersion: order.releaseVersion,
    releaseName: order.releaseName ?? order.releaseVersion,
    note: order.note,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    counts: order._count,
    persistedStatus: input.persistedStatus,
    lifecycle: input.lifecycle,
    resumeStep: input.resumeStep,
    preflight: {
      ready:
        repositoryReady &&
        baselineRoles.has("staging") &&
        baselineRoles.has("production"),
      repository: {
        ready: repositoryReady,
        branch:
          order.project.repositoryIdentity?.currentRevision?.defaultBranch ||
          null,
        identityRevisionId:
          order.project.repositoryIdentity?.currentRevision?.id || null,
        identityRevision:
          order.project.repositoryIdentity?.currentRevision?.revision || null,
      },
      staging: { ready: baselineRoles.has("staging") },
      production: { ready: baselineRoles.has("production") },
    },
  };
}
