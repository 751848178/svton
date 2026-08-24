/**
 * 预发发布工作台步骤模型：完整步骤固定为 [前置检查 → 构建 → 部署]。
 *
 * 生产发布不是本工作台的步骤：生产直接复用预发验证通过的制品
 * （见 release-round-production-card），发布单推进到 production 阶段时
 * 三个步骤全部视为已完成。
 */
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../../types/release-order.types';
import { releaseOrderStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderFailureLabelKey } from '../../utils/release-order.utils';

export const RELEASE_WORKBENCH_STEPS = ['preflight', 'build', 'staging'] as const;
export type ReleaseWorkbenchStep = (typeof RELEASE_WORKBENCH_STEPS)[number];

export type ReleaseWorkbenchStepState = 'completed' | 'current' | 'waiting' | 'blocked';

type StepLabelKey =
  | 'releaseWorkbenchStepPreflight'
  | 'releaseWorkbenchStepBuild'
  | 'releaseWorkbenchStepDeploy';

export interface ReleaseWorkbenchStepView {
  key: ReleaseWorkbenchStep;
  number: number;
  labelKey: StepLabelKey;
  state: ReleaseWorkbenchStepState;
  stateLabelKey: string;
  /** 与服务端 resumeStep 一致的执行当前位置（仅一个步骤为 true）。 */
  isCurrent: boolean;
}

const STEP_LABELS: Record<ReleaseWorkbenchStep, StepLabelKey> = {
  preflight: 'releaseWorkbenchStepPreflight',
  build: 'releaseWorkbenchStepBuild',
  staging: 'releaseWorkbenchStepDeploy',
};

const STEP_RANK: Record<ReleaseWorkbenchStep, number> = {
  preflight: 0,
  build: 1,
  staging: 2,
};

/**
 * production 阶段在预发工作台中超出最后一步：三个步骤全部完成、无当前步骤
 * （生产发布由轮次信息栏的「发布到生产」承接，不是工作台步骤）。
 */
export function workbenchExecutionStep(
  resumeStep: ReleaseOrderStep,
): ReleaseWorkbenchStep | null {
  return resumeStep === 'production' ? null : resumeStep;
}

export function buildReleaseWorkbenchStepViews(detail: ReleaseOrderDetail): ReleaseWorkbenchStepView[] {
  const executionStep = workbenchExecutionStep(detail.resumeStep);
  return RELEASE_WORKBENCH_STEPS.map((key, index) => {
    const state = resolveState(detail, key, executionStep);
    return {
      key,
      number: index + 1,
      labelKey: STEP_LABELS[key],
      state,
      stateLabelKey: resolveStateLabel(detail, key, state),
      isCurrent: key === executionStep,
    };
  });
}

function resolveState(
  detail: ReleaseOrderDetail,
  step: ReleaseWorkbenchStep,
  executionStep: ReleaseWorkbenchStep | null,
): ReleaseWorkbenchStepState {
  const failedHere = Boolean(detail.lifecycle.failureKind) && detail.lifecycle.phase === step;
  const withdrawnHere = detail.lifecycle.status === 'withdrawn' && detail.resumeStep === step;
  if (failedHere || withdrawnHere) return 'blocked';
  if (!executionStep || STEP_RANK[step] < STEP_RANK[executionStep]) return 'completed';
  return step === executionStep ? 'current' : 'waiting';
}

function resolveStateLabel(
  detail: ReleaseOrderDetail,
  step: ReleaseWorkbenchStep,
  state: ReleaseWorkbenchStepState,
): string {
  if (state === 'blocked') {
    if (detail.lifecycle.phase === step) {
      return releaseOrderFailureLabelKey(detail.lifecycle.failureKind) || 'releaseOrderStatusWithdrawn';
    }
    return 'releaseOrderStatusWithdrawn';
  }
  if (state === 'completed') {
    return step === 'preflight' ? 'releaseStepStateBaselineEstablished' : 'releaseStepStateCompleted';
  }
  if (state === 'current' && detail.lifecycle.phase === step) {
    const labelKey = releaseOrderStatusLabelKey(detail.lifecycle.status);
    // PX-29：状态文案恰为阶段名（如 staging →「预发（Staging）发布」）时，
    // 副标题回落为状态语义（「当前步骤」），保证三个步骤副标题语义一致。
    if (labelKey === 'releaseOrderStatusStaging' || labelKey === 'releaseOrderStatusProduction') {
      return 'releaseStepStateCurrent';
    }
    return labelKey;
  }
  return state === 'current' ? 'releaseStepStateCurrent' : 'releaseStepStateWaiting';
}
