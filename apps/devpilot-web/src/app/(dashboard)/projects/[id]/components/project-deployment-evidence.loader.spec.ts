import { describe, expect, it, vi } from 'vitest';
import type { DeploymentRun } from '../types/operations';
import { loadProjectDeploymentEvidence } from './project-deployment-evidence.loader';

describe('deployment evidence loader', () => {
  it('loads exact run, log, and audit endpoints by deploymentRunId', async () => {
    const run = { id: 'run/1', projectId: 'project/1' } as DeploymentRun;
    const request = vi.fn(async (route: string) => {
      if (route.startsWith('GET:/deployments/runs/')) return run;
      if (route === 'GET:/logs/streams') return [{ id: 'stream-1' }];
      if (route === 'GET:/logs/entries') return [{ id: 'entry-1' }];
      return [{ id: 'audit-1' }];
    });
    const result = await loadProjectDeploymentEvidence({ projectId: 'project/1', runId: 'run/1', request });
    expect(request.mock.calls).toEqual([
      ['GET:/deployments/runs/run%2F1?projectId=project%2F1'],
      ['GET:/logs/streams', { deploymentRunId: 'run/1' }],
      ['GET:/logs/entries', { deploymentRunId: 'run/1' }],
      ['GET:/audit-events', { deploymentRunId: 'run/1' }],
    ]);
    expect(result).toMatchObject({
      run, streams: [{ id: 'stream-1' }], entries: [{ id: 'entry-1' }], audits: [{ id: 'audit-1' }],
      logsError: '', auditError: '',
    });
  });

  it('keeps exact detail available when auxiliary evidence is unavailable', async () => {
    const run = { id: 'run-1', projectId: 'project-1' } as DeploymentRun;
    const request = vi.fn(async (route: string) => {
      if (route.startsWith('GET:/deployments/runs/')) return run;
      throw new Error(`${route} unavailable`);
    });
    const result = await loadProjectDeploymentEvidence({ projectId: 'project-1', runId: 'run-1', request });
    expect(result.run).toBe(run);
    expect(result.logsError).toContain('GET:/logs/streams unavailable');
    expect(result.auditError).toContain('GET:/audit-events unavailable');
  });
});
