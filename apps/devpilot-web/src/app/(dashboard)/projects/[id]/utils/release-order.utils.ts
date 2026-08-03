import type { CreateReleaseOrderInput } from '../types/release-order.types';

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
  if (status === 'active' || status === 'running') return 'running';
  return 'idle';
}
