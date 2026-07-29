import { ReleaseSecretLeakVerificationService } from './release-secret-leak-verification.service';

describe('ReleaseSecretLeakVerificationService', () => {
  it('returns and audits only safe finding metadata', async () => {
    const sentinel = 'CodexF383SentinelValue';
    const repository = {
      load: jest.fn().mockResolvedValue({
        planId: 'plan-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        records: [{
          recordType: 'server_execution_job',
          recordId: 'job-1',
          fields: { metadata: { token: sentinel } },
        }],
      }),
    };
    const accessPolicy = { assertCanWrite: jest.fn() };
    const auditEvents = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const service = new ReleaseSecretLeakVerificationService(
      repository as never,
      accessPolicy as never,
      auditEvents as never,
    );

    const result = await service.verify({
      teamId: 'team-1',
      actorId: 'actor-1',
      planId: 'plan-1',
      candidateSecrets: [sentinel],
    });

    expect(result.verdict).toBe('leak_detected');
    expect(result.coverageComplete).toBe(true);
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(JSON.stringify(auditEvents.create.mock.calls)).not.toContain(sentinel);
  });

  it('does not count boolean runtime flags as candidate secrets', async () => {
    const repository = {
      load: jest.fn().mockResolvedValue({
        planId: 'plan-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        records: [{
          recordType: 'deployment_run',
          recordId: 'run-1',
          fields: { params: { forceResetPassword: 'true' } },
        }],
      }),
    };
    const auditEvents = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const service = new ReleaseSecretLeakVerificationService(
      repository as never,
      { assertCanWrite: jest.fn() } as never,
      auditEvents as never,
    );

    const result = await service.verify({
      teamId: 'team-1',
      actorId: 'actor-1',
      planId: 'plan-1',
      candidateSecrets: ['true'],
    });

    expect(result).toMatchObject({
      verdict: 'clean',
      candidateCount: 0,
      findingCount: 0,
    });
  });

  it('fails closed and audits when persisted evidence cannot be loaded', async () => {
    const auditEvents = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const service = new ReleaseSecretLeakVerificationService(
      { load: jest.fn().mockRejectedValue(new Error('database unavailable')) } as never,
      { assertCanWrite: jest.fn() } as never,
      auditEvents as never,
    );

    await expect(service.verify({
      teamId: 'team-1',
      actorId: 'actor-1',
      planId: 'plan-1',
    })).rejects.toThrow('零泄漏验证失败，未生成通过结论');
    expect(auditEvents.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'release_plan.secret_leak.verification_failed',
      targetId: 'plan-1',
      metadata: { coverageComplete: false },
    }));
  });
});
