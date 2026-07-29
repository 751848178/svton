import { BadRequestException, ConflictException } from '@nestjs/common';
import { RepositoryAnalysisRunService } from './repository-analysis-run.service';

describe('RepositoryAnalysisRunService', () => {
  const connection = {
    id: 'connection-1',
    status: 'connected',
    repositoryUrl: 'https://example.com/repo.git',
    selectedBranch: 'main',
    commitSha: 'a'.repeat(40),
  };
  const secretCommand = 'JWT_SECRET=sentinel-jwt node server.js';

  function createHarness() {
    const connections = {
      assertProject: jest.fn().mockResolvedValue({ id: 'project-1' }),
      findByProject: jest.fn().mockResolvedValue(connection),
    };
    const runs = {
      findIdempotent: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      findScoped: jest.fn(),
      requestCancel: jest.fn(),
    };
    const worker = { enqueue: jest.fn(), cancel: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new RepositoryAnalysisRunService(
      connections as never,
      runs as never,
      worker as never,
      audit as never,
    );
    return { service, connections, runs, worker, audit };
  }

  it('returns the same run for a repeated project idempotency key', async () => {
    const harness = createHarness();
    const existing = {
      id: 'run-existing',
      status: 'running',
      suggestions: [{ currentValue: { deployConfig: { initializationCommand: secretCommand } } }],
    };
    harness.runs.findIdempotent.mockResolvedValue(existing);

    const result = await harness.service.start('team-1', 'user-1', 'project-1', {
      idempotencyKey: 'request-1',
    });
    expect(result).toEqual(expect.objectContaining({ id: existing.id }));
    expect(JSON.stringify(result)).not.toContain('sentinel-jwt');
    expect(harness.runs.findActive).not.toHaveBeenCalled();
    expect(harness.runs.create).not.toHaveBeenCalled();
    expect(harness.worker.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a second active run before creating work', async () => {
    const harness = createHarness();
    harness.runs.findIdempotent.mockResolvedValue(null);
    harness.runs.findActive.mockResolvedValue({ id: 'run-active' });

    await expect(harness.service.start('team-1', 'user-1', 'project-1', {
      idempotencyKey: 'request-2',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(harness.runs.create).not.toHaveBeenCalled();
  });

  it('creates exactly one immutable snapshot and enqueues it after audit', async () => {
    const harness = createHarness();
    harness.runs.findIdempotent.mockResolvedValue(null);
    harness.runs.findActive.mockResolvedValue(null);
    harness.runs.create.mockResolvedValue({
      id: 'run-new',
      branch: 'main',
      commitSha: connection.commitSha,
      parserVersion: 'repository-parser-v1',
    });

    const result = await harness.service.start('team-1', 'user-1', 'project-1', {
      branch: 'main',
      idempotencyKey: 'request-3',
    });

    expect(harness.runs.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      projectId: 'project-1',
      connectionId: connection.id,
      repositoryUrl: connection.repositoryUrl,
      branch: 'main',
      commitSha: connection.commitSha,
      idempotencyKey: 'request-3',
    }));
    expect(harness.audit.record).toHaveBeenCalled();
    expect(harness.worker.enqueue).toHaveBeenCalledWith('run-new');
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
      connectionId: connection.id,
      repositoryUrl: connection.repositoryUrl,
      branch: connection.selectedBranch,
      commitSha: connection.commitSha,
    };
    harness.runs.findScoped.mockResolvedValue(source);
    harness.runs.findActive.mockResolvedValue(null);
    harness.runs.create.mockResolvedValue({ ...source, id: 'run-retry' });

    await expect(
      harness.service.retry('team-1', 'user-1', 'project-1', source.id),
    ).resolves.toEqual(expect.objectContaining({ id: 'run-retry' }));
    expect(harness.runs.create).toHaveBeenCalledWith(expect.objectContaining({
      retryOfId: source.id,
      repositoryUrl: source.repositoryUrl,
      branch: source.branch,
      commitSha: source.commitSha,
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
