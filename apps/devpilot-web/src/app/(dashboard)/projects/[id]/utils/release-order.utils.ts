import type { CreateReleaseOrderInput } from '../types/release-order.types';
import type { ReleaseOrderLifecycle } from '../types/release-order-lifecycle.types';

export function buildReleaseOrderInput(
  releaseVersion: string,
  note: string,
): CreateReleaseOrderInput {
  const normalizedNote = note.trim();
  return {
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
