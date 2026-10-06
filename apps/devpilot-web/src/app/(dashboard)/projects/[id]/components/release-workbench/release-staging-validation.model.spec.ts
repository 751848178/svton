import { describe, expect, it } from 'vitest';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { releaseStagingValidationChecks } from './release-staging-validation.model';

describe('releaseStagingValidationChecks', () => {
  it('keeps technical and business validation evidence independent', () => {
    const checks = releaseStagingValidationChecks(
      run({
        workloadReady: { status: 'passed' },
        healthProbe: { status: 'succeeded' },
        httpProbe: { status: 'failed' },
        businessValidation: { status: 'pending' },
      }),
    );
    expect(checks.map(({ key, label, tone }) => ({ key, label, tone }))).toEqual([
      { key: 'workloadReady', label: 'passed', tone: 'success' },
      { key: 'healthProbe', label: 'passed', tone: 'success' },
      { key: 'httpProbe', label: 'failed', tone: 'danger' },
      { key: 'businessValidation', label: 'pending', tone: 'warning' },
    ]);
  });

  it('does not turn missing evidence into a passing check', () => {
    expect(
      releaseStagingValidationChecks(run({})).every(
        (check) => check.label === 'unavailable' && check.tone === 'neutral',
      ),
    ).toBe(true);
  });

  it('uses only a check-owned timestamp and exposes the exact source field', () => {
    const [workload, health] = releaseStagingValidationChecks(
      run({
        workloadReady: { status: 'passed', checkedAt: '2026-08-28T01:00:00.000Z' },
        healthProbe: { status: 'passed' },
      }),
    );
    expect(workload).toMatchObject({
      sourcePath: 'result.workloadReady',
      checkedAt: '2026-08-28T01:00:00.000Z',
      raw: { status: 'passed', checkedAt: '2026-08-28T01:00:00.000Z' },
    });
    expect(health?.checkedAt).toBeNull();
  });
});

function run(result: unknown) {
  return { result } as ReleaseStagingDeploymentItem;
}
