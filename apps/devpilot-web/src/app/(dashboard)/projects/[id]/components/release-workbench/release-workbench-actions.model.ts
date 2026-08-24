/**
 * 工作台动作派生模型（纯函数）：
 * - 预警条门禁合成：目录 ready 但动作门禁拒绝 → 按阻断呈现（含真实原因）。
 * - 发布可用性：制品缺失 / 部署门禁拒绝 / 部署进行中 三态。
 */
import type { ReleaseActionGate } from '../release-action-gate.model';
import type { ReleaseOrderStep } from '../../types/release-order.types';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import type { ReleaseWorkbenchGateSummary } from './release-workbench-summary.model';

export function buildWorkbenchDecisionGate(input: {
  decisionStep: ReleaseOrderStep;
  catalogGate: ReleaseWorkbenchGateSummary;
  actionGate: ReleaseActionGate;
}): ReleaseWorkbenchGateSummary {
  const { decisionStep, catalogGate, actionGate } = input;
  if (decisionStep !== 'production' && !actionGate.allowed && catalogGate.state === 'ready') {
    return {
      ...catalogGate,
      state: 'blocked' as const,
      blockerCount: Math.max(1, catalogGate.blockerCount),
      reason: actionGate.reason,
    };
  }
  return catalogGate;
}

export interface WorkbenchPublishState {
  disabled: boolean;
  /** 无成功制品（优先文案）。 */
  noManifest: boolean;
  /** 部署门禁拒绝（次要文案=门禁原因）。 */
  blockedByGate: boolean;
}

export function workbenchPublishState(input: {
  deployableBuild: ReleaseBuildItem | null;
  stagingGate: { allowed: boolean; reason: string };
  deploying: boolean;
}): WorkbenchPublishState {
  const noManifest = !input.deployableBuild;
  const blockedByGate = input.stagingGate.allowed === false;
  return { disabled: noManifest || blockedByGate || input.deploying, noManifest, blockedByGate };
}
