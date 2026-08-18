/**
 * 发布进度步骤状态归并（纯函数，第 0 步）
 *
 * 单一职责：把单个运行（构建/预发部署/生产发布）的状态字符串归并为时间线
 * 步骤的三态+等待审批。状态词汇按资源严格区分：DeploymentRun（预发部署）
 * 用双 L 的 cancelled、blocked=等待审批；BuildRun 与 ReleaseRun 用单 L 的
 * canceled。等待审批给出审批入口链接（有审批 ID 直达，否则待审批列表）。
 */

import { settingsEnvironmentTabHref } from '../../utils/settings-environment-route';

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
  /** 后端已给出的原因（如构建 errorMessage/errorCode），原样交组件层翻译。 */
  reasonText: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** 等待审批时的审批入口链接；无对应审批时给待审批列表过滤链接。 */
  approvalHref: string | null;
}

/** 各资源运行态词汇表：active=进行中 done=成功 failed=终态失败 awaiting=等待审批。 */
const STEP_VOCAB = {
  // BuildRun: queued|running|succeeded|failed|canceled
  build: { active: 'queued|running', done: 'succeeded', failed: 'failed|canceled', awaiting: '' },
  // DeploymentRun: queued|running|completed|failed|blocked|cancelled（blocked=等待审批）
  deployment: {
    active: 'queued|running|created',
    done: 'completed|succeeded',
    failed: 'failed|cancelled|canceled',
    awaiting: 'blocked',
  },
  // ReleaseRun: pending|awaiting_approval|running|awaiting_validation|succeeded|failed|canceled
  release: {
    active: 'pending|running|awaiting_validation',
    done: 'succeeded',
    failed: 'failed|canceled|cancelled',
    awaiting: 'awaiting_approval',
  },
} as const;

type StepKind = keyof typeof STEP_VOCAB;

export function stepVocabActive(kind: StepKind, status: string): boolean {
  return vocab(kind, 'active').has(status.toLowerCase());
}

export function stepVocabAwaiting(kind: StepKind, status: string): boolean {
  return vocab(kind, 'awaiting').has(status.toLowerCase());
}

export function runStep(
  id: ReleaseProgressStepId,
  kind: StepKind,
  status: string | null,
  meta: {
    startedAt: string | null;
    finishedAt: string | null;
    reasonText: string | null;
    approval: { id?: string } | null | undefined;
  },
): ReleaseProgressStep {
  const step: ReleaseProgressStep = {
    id,
    status: 'pending',
    reasonCode: null,
    reasonText: meta.reasonText,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    approvalHref: null,
  };
  if (!status) return step;
  const normalized = status.toLowerCase();
  if (vocab(kind, 'done').has(normalized)) {
    step.status = 'succeeded';
  } else if (vocab(kind, 'awaiting').has(normalized)) {
    step.status = 'awaiting_approval';
    step.approvalHref = approvalHref(meta.approval ?? null);
  } else if (vocab(kind, 'failed').has(normalized)) {
    step.status = 'failed';
    if (!meta.reasonText) step.reasonCode = 'unknown';
  } else if (vocab(kind, 'active').has(normalized)) {
    step.status = 'running';
  }
  return step;
}

export function approvalHref(approval: { id?: string } | null): string {
  return approval?.id
    ? `/operation-approvals?id=${encodeURIComponent(approval.id)}`
    : '/operation-approvals?status=pending&targetType=release_stage';
}

export function humanRunError(message: string | null, code: string | null): string | null {
  return message && message.trim() ? message.trim() : code ? code : null;
}

/**
 * m-f 注记：发布前检查（发布单级就绪）无独立重跑端点 —— 既有
 * production-preflight-refresh 依赖生产预览（制品），不适用于本步骤；失败态
 * 只给设置深链：仓库问题去「仓库」区，环境问题去「环境」区。
 */
export function preflightSettingsHref(projectId: string, reasonCode: string | null): string {
  if (reasonCode === 'preflight_repository') {
    return `/projects/${encodeURIComponent(projectId)}/settings?section=repository`;
  }
  return settingsEnvironmentTabHref(projectId, null, 'targets');
}

function vocab(kind: StepKind, field: 'active' | 'done' | 'failed' | 'awaiting') {
  return new Set(STEP_VOCAB[kind][field].split('|').filter(Boolean));
}
