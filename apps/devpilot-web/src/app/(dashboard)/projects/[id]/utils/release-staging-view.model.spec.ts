import { describe, expect, it } from 'vitest';
import type { ReleaseStagingDeploymentItem } from '../types/release-order.types';
import {
  stagingBusinessConclusion,
  stagingManifestSucceeded,
  stagingTechnicalConclusion,
} from './release-staging-view.model';

describe('release staging view model', () => {
  it('separates technical health from non-blocking business validation', () => {
    const item = run('completed', {
      workloadReady: { status: 'passed' },
      healthProbe: { status: 'passed' },
      httpProbe: { status: 'not_configured' },
    });
    expect(stagingTechnicalConclusion(item)).toEqual({
      key: 'releaseStagingVerificationPassed',
      tone: 'success',
    });
    expect(stagingBusinessConclusion(item)).toEqual({
      key: 'releaseStagingBusinessPending',
      tone: 'warning',
    });
  });

  it.each([
    ['running', {}, 'releaseStagingVerificationRunning'],
    ['failed', {}, 'releaseStagingVerificationFailed'],
    ['blocked', {}, 'releaseStagingVerificationFailed'],
    ['completed', {}, 'releaseStagingVerificationUnavailable'],
    ['completed', { healthProbe: { status: 'failed' } }, 'releaseStagingVerificationFailed'],
  ])('maps %s evidence without guessing', (status, result, key) => {
    expect(stagingTechnicalConclusion(run(status, result)).key).toBe(key);
  });

  it('requires a non-dry-run terminal deployment for the exact Manifest', () => {
    expect(stagingManifestSucceeded('manifest-1', [run('completed', {}, false)])).toBe(true);
    expect(stagingManifestSucceeded('manifest-1', [run('completed', {}, true)])).toBe(false);
    expect(stagingManifestSucceeded('manifest-2', [run('completed', {}, false)])).toBe(false);
  });
});

function run(status: string, result: unknown, dryRun = false) {
  return {
    id: `run-${status}`,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    artifactManifestId: 'manifest-1',
    status,
    dryRun,
    result,
  } as ReleaseStagingDeploymentItem;
}
