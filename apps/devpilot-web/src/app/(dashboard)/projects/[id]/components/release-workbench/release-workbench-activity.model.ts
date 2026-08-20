import type {
  ReleaseEvidenceProductionRun,
  ReleaseOrderEvidence,
} from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../../types/release-order.types';

export type ReleaseWorkbenchActivityKind =
  | 'order'
  | 'build'
  | 'staging'
  | 'approval'
  | 'production'
  | 'production_deployment';

export interface ReleaseWorkbenchActivity {
  id: string;
  kind: ReleaseWorkbenchActivityKind;
  status: string;
  at: string;
  actor: string | null;
  step: ReleaseOrderStep;
  buildRunId?: string;
  deploymentRunId?: string;
  releaseRunId?: string;
}

export type ReleaseWorkbenchActivityGroupKind = 'order' | 'build' | 'staging' | 'production';

export interface ReleaseWorkbenchActivityGroup {
  kind: ReleaseWorkbenchActivityGroupKind;
  latest: ReleaseWorkbenchActivity;
  history: ReleaseWorkbenchActivity[];
  count: number;
}

export function buildReleaseWorkbenchActivities(
  detail: ReleaseOrderDetail,
  evidence: ReleaseOrderEvidence | null,
): ReleaseWorkbenchActivity[] {
  const activities: ReleaseWorkbenchActivity[] = [
    {
      id: `order:${detail.id}`,
      kind: 'order',
      status: 'created',
      at: detail.createdAt,
      actor: null,
      step: 'preflight',
    },
  ];

  for (const run of evidence?.buildRuns.items ?? []) {
    activities.push({
      id: `build:${run.id}`,
      kind: 'build',
      status: run.status,
      at: run.finishedAt || run.startedAt || run.createdAt,
      actor: null,
      step: 'build',
      buildRunId: run.id,
    });
  }
  for (const run of evidence?.stagingDeploymentRuns.items ?? []) {
    activities.push({
      id: `staging:${run.id}`,
      kind: 'staging',
      status: run.status,
      at: run.finishedAt || run.startedAt || run.createdAt,
      actor: null,
      step: 'staging',
      deploymentRunId: run.id,
    });
  }
  for (const run of evidence?.productionReleaseRuns.items ?? []) {
    activities.push(...productionActivities(run));
  }

  return activities
    .filter((item) => Boolean(item.at))
    .sort((left, right) => timestamp(right.at) - timestamp(left.at))
    .slice(0, 12);
}

export function buildReleaseWorkbenchActivityGroups(
  activities: ReleaseWorkbenchActivity[],
): ReleaseWorkbenchActivityGroup[] {
  const grouped = new Map<ReleaseWorkbenchActivityGroupKind, ReleaseWorkbenchActivity[]>();
  for (const activity of activities) {
    const key = activityGroupKind(activity.kind);
    grouped.set(key, [...(grouped.get(key) ?? []), activity]);
  }
  return [...grouped.entries()]
    .map(([kind, items]) => ({
      kind,
      latest: items[0]!,
      history: items.slice(1),
      count: items.length,
    }))
    .sort((left, right) => timestamp(right.latest.at) - timestamp(left.latest.at));
}

function productionActivities(run: ReleaseEvidenceProductionRun): ReleaseWorkbenchActivity[] {
  const approval = run.operationApproval;
  const approvalActor = approval.reviewedAt ? approval.reviewer : approval.requester;
  const activities: ReleaseWorkbenchActivity[] = [
    {
      id: `production:${run.id}`,
      kind: 'production',
      status: run.status,
      at: run.finishedAt || run.startedAt || run.createdAt,
      actor: null,
      step: 'production',
      releaseRunId: run.id,
      deploymentRunId: run.deploymentRuns[0]?.id,
    },
    {
      id: `approval:${approval.id}`,
      kind: 'approval',
      status: approval.status,
      at: approval.reviewedAt || approval.requestedAt,
      actor: approvalActor?.name || approvalActor?.email || null,
      step: 'production',
      releaseRunId: run.id,
      deploymentRunId: run.deploymentRuns[0]?.id,
    },
  ];
  for (const deployment of run.deploymentRuns) {
    activities.push({
      id: `production-deployment:${deployment.id}`,
      kind: 'production_deployment',
      status: deployment.status,
      at: deployment.finishedAt || deployment.startedAt || deployment.createdAt,
      actor: null,
      step: 'production',
      releaseRunId: run.id,
      deploymentRunId: deployment.id,
    });
  }
  return activities;
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function activityGroupKind(
  kind: ReleaseWorkbenchActivityKind,
): ReleaseWorkbenchActivityGroupKind {
  if (kind === 'build' || kind === 'staging' || kind === 'order') return kind;
  return 'production';
}
