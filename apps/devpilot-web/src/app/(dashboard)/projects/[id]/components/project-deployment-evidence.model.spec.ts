import { describe, expect, it } from 'vitest';
import type { DeploymentRun } from '../types/operations';
import {
  deploymentHealthEvidence,
  deploymentReleaseOrderId,
  deploymentRunNeedsPolling,
} from './project-deployment-evidence.model';

describe('project deployment evidence model', () => {
  it('polls only mutable run states', () => {
    expect(deploymentRunNeedsPolling('queued')).toBe(true);
    expect(deploymentRunNeedsPolling('running')).toBe(true);
    expect(deploymentRunNeedsPolling('blocked')).toBe(true);
    expect(deploymentRunNeedsPolling('completed')).toBe(false);
    expect(deploymentRunNeedsPolling('failed')).toBe(false);
  });

  it('does not infer validation success from an overall completed run', () => {
    const evidence = deploymentHealthEvidence(fixture({ status: 'completed', result: {} }));
    expect(evidence.target).toBeNull();
    expect(evidence.step).toBeNull();
    expect(evidence.observed).toBeNull();
  });

  it('reads only a matching health step result and the real release link', () => {
    const run = fixture({
      healthCheckUrl: 'https://app.example.com/health',
      commandPlan: { steps: [{ key: 'health_check', label: 'Health', command: 'curl', cwd: '/', required: true }] },
      result: { stepResults: [{ key: 'health_check', status: 'failed', exitCode: 22, durationMs: 900 }] },
      artifactManifest: { id: 'manifest-1', releaseOrderId: 'order-1' },
    });
    expect(deploymentHealthEvidence(run)).toMatchObject({
      target: 'https://app.example.com/health',
      observed: { status: 'failed', exitCode: 22, durationMs: 900 },
    });
    expect(deploymentReleaseOrderId(run)).toBe('order-1');
  });
});

function fixture(patch: Partial<DeploymentRun>): DeploymentRun {
  return {
    id: 'run-1', projectId: 'project-1', environment: 'staging', targetType: 'application',
    dryRun: false, source: 'manual', status: 'running', branch: 'main', commitSha: null,
    commandPlan: null, error: null, startedAt: '2026-08-27T00:00:00Z', finishedAt: null,
    ...patch,
  };
}
