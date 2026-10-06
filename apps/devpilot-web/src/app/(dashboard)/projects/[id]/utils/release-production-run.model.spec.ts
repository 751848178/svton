import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import type { ProductionReleasePreview } from '../types/release-production.types';
import {
  productionConfirmBlocker,
  productionRunNeedsPolling,
} from './release-production-run.model';

describe('release production run model', () => {
  it('fails closed for preflight and occupied environment concurrency', () => {
    expect(productionConfirmBlocker(preview(false, 'available'))).toBe('preflight');
    expect(productionConfirmBlocker(preview(true, 'occupied'))).toBe('concurrency');
    expect(productionConfirmBlocker(preview(true, 'available'))).toBeNull();
    expect(productionConfirmBlocker(null)).toBeNull();
  });

  it('polls ReleaseRun and exact DeploymentRun mutable states only', () => {
    expect(productionRunNeedsPolling(run('awaiting_approval', 'created'))).toBe(true);
    expect(productionRunNeedsPolling(run('failed', 'running'))).toBe(true);
    expect(productionRunNeedsPolling(run('succeeded', 'completed'))).toBe(false);
    expect(productionRunNeedsPolling(run('failed', 'failed'))).toBe(false);
    expect(productionRunNeedsPolling(null)).toBe(false);
  });
});

function preview(
  preApprovalAllowed: boolean,
  concurrency: 'available' | 'occupied',
): ProductionReleasePreview {
  return {
    preflight: {
      decision: { preApprovalAllowed },
      concurrency: { state: concurrency },
    },
  } as unknown as ProductionReleasePreview;
}

function run(status: string, deploymentStatus: string): ReleaseEvidenceProductionRun {
  return {
    status,
    deploymentRuns: [{ status: deploymentStatus }],
  } as unknown as ReleaseEvidenceProductionRun;
}
