import { BadRequestException, ConflictException } from '@nestjs/common';
import { REPOSITORY_ANALYSIS_PARSER_VERSION } from './repository-analysis.constants';
import { RepositoryAnalysisRunService } from './repository-analysis-run.service';

describe('RepositoryAnalysisRunService', () => {
  const snapshot = {
    connectionId: 'connection-1',
    repositoryUrl: 'https://example.com/repo.git',
    branch: 'main',
    commitSha: 'a'.repeat(40),
  };
  const secretCommand = 'JWT_SECRET=sentinel-jwt node server.js';

  function createHarness() {
    const runs = {
      list: jest.fn(),
      findScoped: jest.fn(),
      requestCancel: jest.fn(),
    };
    const claims = { start: jest.fn(), retry: jest.fn() };
    const worker = { enqueue: jest.fn(), cancel: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new RepositoryAnalysisRunService(
      runs as never,
      claims as never,
      worker as never,
      audit as never,
    );
    return { service, runs, claims, worker, audit };
  }

  it('returns the same run for a repeated project idempotency key', async () => {
    const harness = createHarness();
    const existing = {
      id: 'run-existing',
      status: 'running',
      suggestions: [{ currentValue: { deployConfig: { initializationCommand: secretCommand } } }],
    };
    harness.claims.start.mockResolvedValue({ run: existing, replayed: true });

    const result = await harness.service.start('team-1', 'user-1', 'project-1', {
      idempotencyKey: 'request-1',
    });
    expect(result).toEqual(expect.objectContaining({ id: existing.id }));
    expect(JSON.stringify(result)).not.toContain('sentinel-jwt');
    expect(harness.claims.start).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1', projectId: 'project-1', triggeredById: 'user-1',
      idempotencyKey: 'request-1',
    }));
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.worker.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a second active run before creating work', async () => {
    const harness = createHarness();
    harness.claims.start.mockRejectedValue(new ConflictException('active run'));

    await expect(harness.service.start('team-1', 'user-1', 'project-1', {
      idempotencyKey: 'request-2',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(harness.claims.start).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1', projectId: 'project-1', triggeredById: 'user-1',
    }));
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.worker.enqueue).not.toHaveBeenCalled();
  });

  it('creates exactly one immutable snapshot and enqueues it after audit', async () => {
    const harness = createHarness();
    harness.claims.start.mockResolvedValue({ replayed: false, run: {
      id: 'run-new',
      ...snapshot,
      parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
    } });

    const result = await harness.service.start('team-1', 'user-1', 'project-1', {
      branch: 'main',
      idempotencyKey: 'request-3',
    });

    expect(harness.claims.start).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      projectId: 'project-1',
      triggeredById: 'user-1',
      branch: 'main',
      idempotencyKey: 'request-3',
      parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
    }));
    expect(harness.audit.record).toHaveBeenCalled();
    expect(harness.worker.enqueue).toHaveBeenCalledWith('run-new');
    expect(harness.audit.record.mock.invocationCallOrder[0])
      .toBeLessThan(harness.worker.enqueue.mock.invocationCallOrder[0]);
    expect(result.id).toBe('run-new');
  });

  it('always scopes run detail by team and project to reject forged IDs', async () => {
    const harness = createHarness();
    harness.runs.findScoped.mockResolvedValue({
      id: 'run-1',
      result: { services: [{ commands: { bootstrap: secretCommand } }] },
      suggestions: [{ reviewedValue: { deployConfig: { initializationCommand: secretCommand } } }],
    });
    const result = await harness.service.detail('team-1', 'project-1', 'forged-run-id');
    expect(harness.runs.findScoped).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      'forged-run-id',
    );
    expect(JSON.stringify(result)).not.toContain('sentinel-jwt');
    expect(JSON.stringify(result)).toContain('[REDACTED]');
  });

  it('retries the same immutable snapshot with lineage and a fresh run', async () => {
    const harness = createHarness();
    const source = {
      id: 'run-failed',
      ...snapshot,
    };
    harness.runs.findScoped.mockResolvedValue(source);
    harness.claims.retry.mockResolvedValue({ ...source, id: 'run-retry' });

    await expect(
      harness.service.retry('team-1', 'user-1', 'project-1', source.id),
    ).resolves.toEqual(expect.objectContaining({ id: 'run-retry' }));
    expect(harness.runs.findScoped).toHaveBeenCalledWith(
      'team-1', 'project-1', source.id,
    );
    expect(harness.claims.retry).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      projectId: 'project-1',
      triggeredById: 'user-1',
      retryOfId: source.id,
      repositoryUrl: source.repositoryUrl,
      branch: source.branch,
      commitSha: source.commitSha,
      idempotencyKey: expect.stringMatching(/^retry:run-failed:/),
      parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
    }));
    expect(harness.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'repository.analysis.retry',
      targetId: 'run-retry',
    }));
    expect(harness.worker.enqueue).toHaveBeenCalledWith('run-retry');
  });

  it('requests cancellation only for an active scoped run', async () => {
    const harness = createHarness();
    harness.runs.findScoped
      .mockResolvedValueOnce({ id: 'run-active', status: 'running' })
      .mockResolvedValueOnce({
        id: 'run-active',
        status: 'running',
        cancelRequestedAt: new Date(),
        suggestions: [{ reviewedValue: { initializationCommand: secretCommand } }],
      });

    const result = await harness.service.cancel(
      'team-1',
      'user-1',
      'project-1',
      'run-active',
    );

    expect(harness.runs.requestCancel).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      'run-active',
    );
    expect(harness.worker.cancel).toHaveBeenCalledWith('run-active');
    expect(harness.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'repository.analysis.cancel.request',
      targetId: 'run-active',
    }));
    expect(JSON.stringify(result)).not.toContain('sentinel-jwt');
  });

  it('rejects cancellation after a run is terminal', async () => {
    const harness = createHarness();
    harness.runs.findScoped.mockResolvedValue({ id: 'run-done', status: 'succeeded' });

    await expect(
      harness.service.cancel('team-1', 'user-1', 'project-1', 'run-done'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.runs.requestCancel).not.toHaveBeenCalled();
    expect(harness.worker.cancel).not.toHaveBeenCalled();
  });
});
