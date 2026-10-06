import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';

export type ReleaseValidationCheck = {
  key: 'workloadReady' | 'healthProbe' | 'httpProbe' | 'businessValidation';
  status: string;
  label: 'passed' | 'failed' | 'running' | 'pending' | 'notConfigured' | 'unavailable';
  tone: 'success' | 'danger' | 'warning' | 'neutral';
  sourcePath: string;
  checkedAt: string | null;
  raw: Record<string, unknown> | null;
};

const CHECK_KEYS: ReleaseValidationCheck['key'][] = [
  'workloadReady',
  'healthProbe',
  'httpProbe',
  'businessValidation',
];

export function releaseStagingValidationChecks(
  run: ReleaseStagingDeploymentItem,
): ReleaseValidationCheck[] {
  const result = record(run.result);
  return CHECK_KEYS.map((key) => {
    const evidence = nullableRecord(result[key]);
    const status = String(evidence?.status || 'unavailable').toLowerCase();
    const checkedAt = typeof evidence?.checkedAt === 'string' ? evidence.checkedAt : null;
    return {
      key,
      status,
      label: validationLabel(status),
      tone: validationTone(status),
      sourcePath: `result.${key}`,
      checkedAt,
      raw: evidence,
    };
  });
}

function validationLabel(status: string): ReleaseValidationCheck['label'] {
  if (['passed', 'succeeded', 'verified'].includes(status)) return 'passed';
  if (['failed', 'blocked'].includes(status)) return 'failed';
  if (['running', 'created', 'queued'].includes(status)) return 'running';
  if (status === 'pending') return 'pending';
  if (status === 'not_configured') return 'notConfigured';
  return 'unavailable';
}

export function validationTone(status: string): ReleaseValidationCheck['tone'] {
  if (
    ['passed', 'succeeded', 'verified', 'completed', 'active', 'resolved', 'valid', 'switched'].includes(status)
  ) {
    return 'success';
  }
  if (['failed', 'blocked', 'invalid'].includes(status)) return 'danger';
  if (['running', 'pending', 'created', 'queued', 'awaiting_validation'].includes(status)) {
    return 'warning';
  }
  return 'neutral';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableRecord(value: unknown): Record<string, unknown> | null {
  const item = record(value);
  return Object.keys(item).length > 0 ? item : null;
}
