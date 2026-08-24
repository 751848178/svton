/**
 * 环境发布链模型：预发发布（首个发布类型）→ 生产发布（后续环境发布）是串行链路。
 * 节点状态由真实数据推导：预发=制品是否验证通过；生产=最近 ReleaseRun。
 */
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ReleaseChainNode } from '../../utils/project-route.utils';

export type ReleaseChainNodeState = 'current' | 'done' | 'waiting' | 'blocked';

export interface ReleaseChainNodeView {
  key: ReleaseChainNode;
  labelKey: 'releaseChainNodeStaging' | 'releaseChainNodeProduction';
  state: ReleaseChainNodeState;
  stateLabelKey: string;
}

const ACTIVE_RUN_STATUSES = ['created', 'queued', 'running', 'pending', 'awaiting_approval', 'awaiting_validation'];
const DONE_RUN_STATUSES = ['succeeded', 'completed'];

export function buildReleaseChainViews(input: {
  detail: ReleaseOrderDetail;
  stagingProven: boolean;
  productionRuns: ReleaseEvidenceProductionRun[];
}): ReleaseChainNodeView[] {
  const nodes: Array<Omit<ReleaseChainNodeView, 'stateLabelKey'>> = [
    {
      key: 'staging',
      labelKey: 'releaseChainNodeStaging',
      state: stagingState(input.detail, input.stagingProven),
    },
    {
      key: 'production',
      labelKey: 'releaseChainNodeProduction',
      state: productionState(input.productionRuns),
    },
  ];
  return nodes.map((node) => ({ ...node, stateLabelKey: chainStateLabelKey(node.state) }));
}

function stagingState(
  detail: ReleaseOrderDetail,
  stagingProven: boolean,
): ReleaseChainNodeState {
  if (stagingProven) return 'done';
  if (detail.lifecycle.failureKind && detail.lifecycle.phase === 'staging') return 'blocked';
  return 'current';
}

function productionState(runs: ReleaseEvidenceProductionRun[]): ReleaseChainNodeState {
  const latest = [...runs].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )[0];
  if (!latest) return 'waiting';
  const status = latest.status.toLowerCase();
  if (DONE_RUN_STATUSES.includes(status)) return 'done';
  if (ACTIVE_RUN_STATUSES.includes(status)) return 'current';
  return 'blocked';
}

function chainStateLabelKey(state: ReleaseChainNodeState) {
  if (state === 'done') return 'releaseStepStateCompleted';
  if (state === 'current') return 'releaseStepStateCurrent';
  if (state === 'blocked') return 'releaseOrderStatusFailed';
  return 'releaseStepStateWaiting';
}
