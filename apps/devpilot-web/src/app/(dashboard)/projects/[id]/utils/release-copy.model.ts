import type { ReleaseOrderLifecycleStatus } from '../types/release-order-lifecycle.types';
import type {
  EnvironmentVersionKind,
  ReleaseApprovalStatus,
  ReleaseEnvironmentRole,
  ReleaseExecutionStatus,
} from '../types/release-copy.types';

const ORDER_STATUS_KEYS: Record<ReleaseOrderLifecycleStatus, string> = {
  draft: 'releaseOrderStatusDraft',
  building: 'releaseOrderStatusBuilding',
  staging: 'releaseOrderStatusStaging',
  awaiting_approval: 'releaseOrderStatusAwaitingApproval',
  production: 'releaseOrderStatusProduction',
  succeeded: 'releaseOrderStatusSucceeded',
  failed: 'releaseOrderStatusFailed',
  withdrawn: 'releaseOrderStatusWithdrawn',
};

const EXECUTION_STATUS_KEYS: Record<ReleaseExecutionStatus, string> = {
  created: 'releaseExecutionStatusCreated',
  queued: 'releaseExecutionStatusQueued',
  running: 'releaseExecutionStatusRunning',
  succeeded: 'releaseExecutionStatusSucceeded',
  completed: 'releaseExecutionStatusCompleted',
  failed: 'releaseExecutionStatusFailed',
  canceled: 'releaseExecutionStatusCanceled',
  cancelled: 'releaseExecutionStatusCanceled',
  blocked: 'releaseExecutionStatusBlocked',
  pending: 'releaseExecutionStatusPending',
  awaiting_approval: 'releaseExecutionStatusAwaitingApproval',
};

const RUN_STATUS_KEYS: Record<string, string> = {
  queued: 'runStatusQueued',
  running: 'runStatusRunning',
  succeeded: 'runStatusSucceeded',
  success: 'runStatusSucceeded',
  completed: 'runStatusCompleted',
  failed: 'runStatusFailed',
  blocked: 'runStatusBlocked',
  pending: 'runStatusPending',
  awaiting_approval: 'runStatusAwaitingApproval',
  canceled: 'runStatusCancelled',
  cancelled: 'runStatusCancelled',
};

const APPROVAL_STATUS_KEYS: Record<ReleaseApprovalStatus, string> = {
  pending: 'releaseApprovalStatusPending',
  approved: 'releaseApprovalStatusApproved',
  rejected: 'releaseApprovalStatusRejected',
  canceled: 'releaseApprovalStatusCanceled',
  cancelled: 'releaseApprovalStatusCanceled',
};

const VERSION_KIND_KEYS: Record<EnvironmentVersionKind, string> = {
  deploy: 'environmentVersionKindDeploy',
  upgrade: 'environmentVersionKindUpgrade',
  recovery: 'environmentVersionKindRecovery',
};

const ENVIRONMENT_ROLE_KEYS: Record<ReleaseEnvironmentRole, string> = {
  staging: 'releaseEnvironmentStaging',
  production: 'releaseEnvironmentProduction',
};

const STAGE_STATUS_KEYS: Record<string, string> = {
  planned: 'runStagePlanned',
  not_started: 'runStageNotStarted',
  completed: 'runStageCompleted',
  failed: 'runStageFailed',
  skipped: 'runStageSkipped',
  canceled: 'runStageCancelled',
  cancelled: 'runStageCancelled',
};

const RISK_KEYS: Record<string, string> = {
  low: 'riskLow',
  medium: 'riskMedium',
  high: 'riskHigh',
};

const CLIENT_ERROR_KEYS = new Set([
  'releaseStagingScopeMismatch',
  'releaseProductionPreviewScopeMismatch',
  'releaseProductionRunScopeMismatch',
]);

export function releaseOrderStatusLabelKey(status: string) {
  return ORDER_STATUS_KEYS[status as ReleaseOrderLifecycleStatus] || 'releaseOrderStatusUnknown';
}

export function releaseExecutionStatusLabelKey(status: string) {
  return EXECUTION_STATUS_KEYS[status as ReleaseExecutionStatus] || 'releaseExecutionStatusUnknown';
}

export function releaseRunStatusLabelKey(status: string) {
  return RUN_STATUS_KEYS[status.toLowerCase()] || 'runStatusUnknown';
}

export function releaseApprovalStatusLabelKey(status: string) {
  return (
    APPROVAL_STATUS_KEYS[status.toLowerCase() as ReleaseApprovalStatus] ||
    'releaseApprovalStatusUnknown'
  );
}

export function environmentVersionKindLabelKey(kind: string) {
  return VERSION_KIND_KEYS[kind as EnvironmentVersionKind] || 'environmentVersionKindUnknown';
}

export function releaseEnvironmentLabelKey(role: string | null | undefined) {
  return releaseEnvironmentValueLabelKey(role) || 'releaseEnvironmentUnknown';
}

export function releaseEnvironmentValueLabelKey(value: string | null | undefined) {
  const normalized = value?.toLowerCase() === 'prod' ? 'production' : value?.toLowerCase();
  return normalized ? ENVIRONMENT_ROLE_KEYS[normalized as ReleaseEnvironmentRole] || null : null;
}

export function releaseDeploymentStageStatusLabelKey(status: string) {
  return STAGE_STATUS_KEYS[status.toLowerCase()] || 'runStageUnknown';
}

export function releaseRiskLabelKey(risk: string) {
  return RISK_KEYS[risk.toLowerCase()] || 'riskUnknown';
}

export function releaseClientErrorLabelKey(error: string) {
  return CLIENT_ERROR_KEYS.has(error) ? error : null;
}

/**
 * Production 上下文错误 → 稳定客户端错误键（AC-PROD-036）。
 *
 * 门禁拒绝的服务端 message 带内部 stage token（admit/finalize/production），
 * 这里按稳定签名本地化，绝不把 decision.stage 或错误对象原始输出到 DOM。
 * 无法识别的错误回退到通用键，仍由 i18n 渲染，避免 raw server message 泄漏。
 */
export function releaseProductionErrorLabelKey(error: string) {
  if (CLIENT_ERROR_KEYS.has(error)) return error;
  if (/门禁未满足/.test(error)) return 'releaseProductionGateDenied';
  if (/审批已过期/.test(error)) return 'releaseProductionApprovalExpired';
  if (/没有匹配的站点/.test(error)) return 'releaseProductionSiteMissing';
  return 'releaseProductionActionFailed';
}
