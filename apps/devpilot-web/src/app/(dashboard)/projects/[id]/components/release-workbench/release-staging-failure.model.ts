const WORKLOAD_START_FAILED = 'WORKLOAD_START_FAILED';

export type ReleaseStagingFailureSummary =
  | { kind: 'workload-start'; service: string }
  | { kind: 'generic' };

export function releaseStagingFailureSummary(
  error: string | null | undefined,
): ReleaseStagingFailureSummary | null {
  const value = error?.trim();
  if (!value) return null;
  if (!value.startsWith(WORKLOAD_START_FAILED)) return { kind: 'generic' };

  const service = value.match(/服务\s+(.+?)\s+启动或探针失败/)?.[1]?.trim();
  return { kind: 'workload-start', service: service || '—' };
}
