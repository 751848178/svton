/**
 * 发布进度模型（纯函数，第 0 步发布进度页）
 *
 * 把后端各域状态（发布单/构建/预发部署/生产发布）归并为用户视角的四步时间线
 * （发布前检查 → 构建 → 预发部署 → 生产发布）；用词遵循设计文档词汇表。
 */

import type {
  ReleaseBuildItem,
  ReleaseOrderDetail,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import type { ProductionReleaseRun } from '../../types/release-production.types';

export type ReleaseProgressStepId = 'preflight' | 'build' | 'staging' | 'production';
export type ReleaseProgressStepStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'awaiting_approval';

export interface ReleaseProgressStep {
  id: ReleaseProgressStepId;
  status: ReleaseProgressStepStatus;
  /** 失败原因词条代码（组件层翻译）；优先级低于 reasonText。 */
  reasonCode: string | null;
  /** 后端已给出的人话原因（如构建 errorMessage），原样展示。 */
  reasonText: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

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
  canPublishToProduction: boolean;
  /** 任一已开始的步骤失败 → 详情内提供「回滚到上一版本」。 */
  canRollback: boolean;
}

const BUILD_ACTIVE = new Set(['queued', 'running']);
const RUN_ACTIVE = new Set(['created', 'queued', 'running', 'pending']);
const RELEASE_ACTIVE = new Set(['approved', 'awaiting_validation', 'awaiting_approval']);
const FAILED_STATUSES = new Set(['failed', 'canceled', 'blocked', 'rejected']);

export function buildReleaseProgressView(input: ReleaseProgressInput): ReleaseProgressView {
  const latestBuild = input.builds[0] ?? null;
  const latestStaging = input.stagingDeployments[0] ?? null;
  const latestProduction = input.productionRuns[0] ?? null;

  const preflight = preflightStep(input.detail);
  const build = runStep('build', latestBuild?.status ?? null, {
    startedAt: latestBuild?.startedAt ?? null,
    finishedAt: latestBuild?.finishedAt ?? null,
    reasonText: humanRunError(latestBuild?.errorMessage ?? null, latestBuild?.errorCode ?? null),
  });
  const stagingStatus = latestStaging ? String(latestStaging.status).toLowerCase() : null;
  const staging = runStep('staging', stagingStatus, {
    startedAt: latestStaging?.startedAt ?? null,
    finishedAt: latestStaging?.finishedAt ?? null,
    reasonText: latestStaging?.error ?? null,
  });
  const production = productionStep(input.detail, latestProduction);
  const steps = [preflight, build, staging, production];

  const stagingSucceeded = staging.status === 'succeeded';
  const productionSucceeded = production.status === 'succeeded';
  const awaitingApproval = production.status === 'awaiting_approval';
  const anyFailed = steps.some((step) => step.status === 'failed');
  const anyActive = steps.some(
    (step) => step.status === 'running' || step.status === 'awaiting_approval',
  );
  const lifecycleDone = input.detail ? lifecycleTerminal(input.detail) : false;

  return {
    steps,
    running: anyActive,
    terminal: productionSucceeded || (!anyActive && lifecycleDone),
    stagingSucceeded,
    productionSucceeded,
    awaitingApproval,
    canPublishToProduction: stagingSucceeded && !input.productionRuns.length,
    canRollback: anyFailed && (Boolean(latestStaging) || Boolean(latestProduction)),
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

function runStep(
  id: ReleaseProgressStepId,
  status: string | null,
  meta: { startedAt: string | null; finishedAt: string | null; reasonText: string | null },
): ReleaseProgressStep {
  const step: ReleaseProgressStep = {
    id,
    status: 'pending',
    reasonCode: null,
    reasonText: meta.reasonText,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
  };
  if (!status) return step;
  const normalized = status.toLowerCase();
  if (normalized === 'succeeded' || normalized === 'completed') {
    step.status = 'succeeded';
  } else if (FAILED_STATUSES.has(normalized)) {
    step.status = 'failed';
    if (!meta.reasonText) step.reasonCode = 'unknown';
  } else if (isReleaseActive(normalized)) {
    step.status = 'running';
  }
  return step;
}

function isReleaseActive(normalized: string): boolean {
  return (
    BUILD_ACTIVE.has(normalized) || RUN_ACTIVE.has(normalized) || RELEASE_ACTIVE.has(normalized)
  );
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
    };
  }
  const step = runStep('production', run.status, {
    startedAt: run.createdAt,
    finishedAt: null,
    reasonText: null,
  });
  if (run.operationApproval?.status === 'pending') {
    step.status = 'awaiting_approval';
  } else if (step.status === 'failed' && !step.reasonText) {
    step.reasonCode =
      run.operationApproval?.status === 'rejected' ? 'approval_rejected' : 'unknown';
  }
  return step;
}

function lifecycleTerminal(detail: ReleaseOrderDetail): boolean {
  return ['succeeded', 'failed', 'withdrawn'].includes(detail.lifecycle.status);
}

function humanRunError(message: string | null, code: string | null): string | null {
  return message && message.trim() ? message.trim() : code ? code : null;
}

function fixedStep(
  id: ReleaseProgressStepId,
  status: ReleaseProgressStepStatus,
  at: string | null,
): ReleaseProgressStep {
  return { id, status, reasonCode: null, reasonText: null, startedAt: at, finishedAt: at };
}
