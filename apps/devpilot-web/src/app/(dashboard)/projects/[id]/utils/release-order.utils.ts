import type { CreateReleaseOrderInput } from '../types/release-order.types';
import type { ReleaseOrderLifecycle } from '../types/release-order-lifecycle.types';

export function buildReleaseOrderInput(
  releaseName: string,
  releaseVersion: string,
  note: string,
): CreateReleaseOrderInput {
  const normalizedNote = note.trim();
  return {
    releaseName: releaseName.trim(),
    releaseVersion: releaseVersion.trim(),
    ...(normalizedNote ? { note: normalizedNote } : {}),
  };
}

export function releaseOrderStatusTone(status: string) {
  if (status === 'succeeded' || status === 'completed') return 'success';
  if (status === 'failed' || status === 'canceled') return 'error';
  if (['active', 'running', 'building', 'staging', 'production'].includes(status)) return 'running';
  return 'idle';
}

/**
 * Production 审批状态 → 语义色调（AC-PROD-035 六态矩阵）。
 * 与 ReleaseRun 运行色调分开，避免 批准/等待审批、拒绝/失败 同色。
 */
export function releaseApprovalStateTone(status: string) {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'info';
    case 'rejected':
      return 'danger';
    case 'canceled':
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Production ReleaseRun/DeploymentRun 运行状态 → 语义色调。
 * 等待审批 与 执行中 分离，拒绝(审批) 与 失败(运行) 分离。
 */
export function releaseRunStateTone(status: string) {
  switch (status.toLowerCase()) {
    case 'awaiting_approval':
      return 'warning';
    case 'created':
    case 'queued':
    case 'running':
    case 'pending':
      return 'progress';
    case 'succeeded':
    case 'completed':
    case 'success':
      return 'success';
    case 'failed':
    case 'blocked':
      return 'danger';
    case 'canceled':
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function releaseOrderFailureLabelKey(failureKind: ReleaseOrderLifecycle['failureKind']) {
  if (!failureKind) return null;
  return FAILURE_LABEL_KEYS[failureKind];
}

const FAILURE_LABEL_KEYS: Record<
  NonNullable<ReleaseOrderLifecycle['failureKind']>,
  | 'releaseOrderFailureFailed'
  | 'releaseOrderFailureBlocked'
  | 'releaseOrderFailureCanceled'
  | 'releaseOrderFailureEvidenceMismatch'
> = {
  failed: 'releaseOrderFailureFailed',
  blocked: 'releaseOrderFailureBlocked',
  canceled: 'releaseOrderFailureCanceled',
  evidence_mismatch: 'releaseOrderFailureEvidenceMismatch',
};
