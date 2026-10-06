import { describe, expect, it } from 'vitest';
import { releaseStagingFailureSummary } from './release-staging-failure.model';

describe('releaseStagingFailureSummary', () => {
  it('extracts the failed workload without exposing the error code as primary copy', () => {
    expect(
      releaseStagingFailureSummary('WORKLOAD_START_FAILED: 服务 @parity/web 启动或探针失败'),
    ).toEqual({ kind: 'workload-start', service: '@parity/web' });
  });

  it('preserves unknown failures as a generic human-facing state', () => {
    expect(releaseStagingFailureSummary('provider exited')).toEqual({ kind: 'generic' });
    expect(releaseStagingFailureSummary('')).toBeNull();
  });
});
