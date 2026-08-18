/**
 * 发布进度模型（纯函数，第 0 步发布进度页）
 *
 * 把后端各域状态（发布单/构建/预发部署/生产发布）归并为用户视角的四步时间线
 * （发布前检查 → 构建 → 预发部署 → 生产发布）；用词遵循设计文档词汇表。
 * 单步状态归并与审批链接见 release-progress-status.model.ts。
 */

import type {
  ReleaseBuildItem,
  ReleaseOrderDetail,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import type { ProductionReleaseRun } from '../../types/release-production.types';
import {
  approvalHref,
  humanRunError,
  runStep,
  stepVocabActive,
  stepVocabAwaiting,
  type ReleaseProgressStep,
  type ReleaseProgressStepId,
  type ReleaseProgressStepStatus,
} from './release-progress-status.model';

export type {
  ReleaseProgressStep,
  ReleaseProgressStepId,
  ReleaseProgressStepStatus,
} from './release-progress-status.model';

export interface ReleaseProgressInput {
  detail: ReleaseOrderDetail | null;
  builds: ReleaseBuildItem[];
  stagingDeployments: ReleaseStagingDeploymentItem[];
  productionRuns: ProductionReleaseRun[];
}

export interface ReleaseProgressView {
  steps: ReleaseProgressStep[];
  /** 仍有步骤在推进（含等待审批）→ 进度页继续轮询。 */
  running: boolean;
  terminal: boolean;
  stagingSucceeded: boolean;
  productionSucceeded: boolean;
  awaitingApproval: boolean;
  /** 等待审批步骤的审批入口链接（优先带审批 ID 的直达链接）。 */
  approvalHref: string | null;
  canPublishToProduction: boolean;
  /** 构建已成功但预发部署从未开始（中断恢复口）：提供「部署预发」。 */
  canDeployStaging: boolean;
  /** 任一步骤失败且生产发布已开始 → 提供回滚（回滚按环境恢复，仅生产环境有版本史）。 */
  canRollback: boolean;
}

/** ReleaseRun 中视为「进行中」的状态（B2：有进行中运行则不可重复发布生产）。 */
const PRODUCTION_RUN_ACTIVE = new Set([
  'pending',
  'awaiting_approval',
  'running',
  'awaiting_validation',
]);

export function buildReleaseProgressView(input: ReleaseProgressInput): ReleaseProgressView {
  const latestBuild = input.builds[0] ?? null;
  const latestStaging = input.stagingDeployments[0] ?? null;
  const latestProduction = input.productionRuns[0] ?? null;

  const preflight = preflightStep(input.detail);
  const build = runStep('build', 'build', latestBuild?.status ?? null, {
    startedAt: latestBuild?.startedAt ?? null,
    finishedAt: latestBuild?.finishedAt ?? null,
    reasonText: humanRunError(latestBuild?.errorMessage ?? null, latestBuild?.errorCode ?? null),
    approval: null,
  });
  const staging = runStep('staging', 'deployment', latestStaging?.status ?? null, {
    startedAt: latestStaging?.startedAt ?? null,
    finishedAt: latestStaging?.finishedAt ?? null,
    reasonText: latestStaging?.error ?? null,
    approval: null,
  });
  const production = productionStep(input.detail, latestProduction);
  const steps = [preflight, build, staging, production];

  const stagingSucceeded = staging.status === 'succeeded';
  const productionSucceeded = production.status === 'succeeded';
  const awaitingStep = steps.find((step) => step.status === 'awaiting_approval') ?? null;
  const anyFailed = steps.some((step) => step.status === 'failed');
  const anyActive = steps.some(
    (step) => step.status === 'running' || step.status === 'awaiting_approval',
  );
  const lifecycleDone = input.detail ? lifecycleTerminal(input.detail) : false;
  // B2：预发成功且无「进行中」生产运行、也无成功生产运行 → 允许（重新）发布生产；
  // 生产失败/取消/审批驳回（终态）后可重发，不因历史失败被永久隐藏。
  const productionActive = input.productionRuns.some(
    (run) =>
      PRODUCTION_RUN_ACTIVE.has(String(run.status).toLowerCase()) &&
      run.operationApproval?.status !== 'rejected',
  );
  const productionEverSucceeded = input.productionRuns.some(
    (run) => String(run.status).toLowerCase() === 'succeeded',
  );
  const succeededManifest = input.builds.some(
    (item) => item.status === 'succeeded' && item.manifest,
  );
  const stagingNonTerminal = input.stagingDeployments.some(
    (item) =>
      stepVocabActive('deployment', String(item.status)) ||
      stepVocabAwaiting('deployment', String(item.status)),
  );

  return {
    steps,
    running: anyActive,
    terminal: productionSucceeded || (!anyActive && lifecycleDone),
    stagingSucceeded,
    productionSucceeded,
    awaitingApproval: Boolean(awaitingStep),
    approvalHref: awaitingStep?.approvalHref ?? null,
    canPublishToProduction: stagingSucceeded && !productionActive && !productionEverSucceeded,
    // 中断恢复：构建成功但预发从未开始且无进行中的预发运行 → 可一键补发预发。
    canDeployStaging:
      succeededManifest &&
      staging.status === 'pending' &&
      !stagingNonTerminal &&
      !productionSucceeded,
    canRollback: anyFailed && Boolean(latestProduction),
  };
}

function preflightStep(detail: ReleaseOrderDetail | null): ReleaseProgressStep {
  if (!detail) return fixedStep('preflight', 'pending', null);
  const firstUnready = [
    { ready: detail.preflight.repository.ready, code: 'preflight_repository' },
    { ready: detail.preflight.staging.ready, code: 'preflight_staging' },
    { ready: detail.preflight.production.ready, code: 'preflight_production' },
  ].find((check) => !check.ready);
  if (!firstUnready) return fixedStep('preflight', 'succeeded', detail.createdAt);
  const step = fixedStep('preflight', 'failed', detail.createdAt);
  step.reasonCode = firstUnready.code;
  return step;
}

function productionStep(
  detail: ReleaseOrderDetail | null,
  run: ProductionReleaseRun | null,
): ReleaseProgressStep {
  // 发布单级审批等待（lifecycle awaiting_approval）即使尚无生产运行也应可见。
  if (!run) {
    const awaiting = detail?.lifecycle.status === 'awaiting_approval';
    return {
      id: 'production',
      status: awaiting ? 'awaiting_approval' : 'pending',
      reasonCode: null,
      reasonText: null,
      startedAt: awaiting ? detail.lifecycle.occurredAt : null,
      finishedAt: null,
      approvalHref: awaiting ? approvalHref(null) : null,
    };
  }
  const step = runStep('production', 'release', run.status, {
    startedAt: run.createdAt,
    finishedAt: null,
    reasonText: null,
    approval: run.operationApproval,
  });
  if (run.operationApproval?.status === 'pending') {
    step.status = 'awaiting_approval';
    step.approvalHref = approvalHref(run.operationApproval);
  } else if (step.status === 'failed' && !step.reasonText) {
    step.reasonCode =
      run.operationApproval?.status === 'rejected' ? 'approval_rejected' : 'unknown';
  }
  return step;
}

function lifecycleTerminal(detail: ReleaseOrderDetail): boolean {
  return ['succeeded', 'failed', 'withdrawn'].includes(detail.lifecycle.status);
}

function fixedStep(
  id: ReleaseProgressStepId,
  status: ReleaseProgressStepStatus,
  at: string | null,
): ReleaseProgressStep {
  return {
    id,
    status,
    reasonCode: null,
    reasonText: null,
    startedAt: at,
    finishedAt: at,
    approvalHref: null,
  };
}
