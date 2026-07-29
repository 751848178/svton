import { scanSecretLeakRecords } from './secret-leak-detector.utils';

describe('scanSecretLeakRecords', () => {
  const record = (fields: Record<string, unknown>) => ({
    recordType: 'deployment_run' as const,
    recordId: 'run-1',
    fields,
  });

  it('finds structural and candidate leaks without returning values', () => {
    const sentinel = 'CodexF383SentinelValue';
    const findings = scanSecretLeakRecords([
      record({
        params: { password: sentinel },
        commandPlan: 'mysql --password=plain-text',
      }),
    ], [sentinel]);

    expect(findings.map((finding) => finding.detector)).toEqual(expect.arrayContaining([
      'sensitive_key_value',
      'candidate_secret',
      'password_flag',
    ]));
    expect(JSON.stringify(findings)).not.toContain(sentinel);
  });

  it('does not flag redacted values or environment references', () => {
    expect(scanSecretLeakRecords([
      record({
        params: { password: '[REDACTED]' },
        commandPlan: '-e DATABASE_URL=$DEVPILOT_DATABASE_URL',
      }),
    ])).toEqual([]);
  });

  it('ignores non-secret flags and persisted masking policy markers', () => {
    expect(scanSecretLeakRecords([
      record({
        commandPlan: {
          safety: { secretsInOutput: 'masked_before_persisting' },
          command: '-e BOOTSTRAP_FORCE_RESET_PASSWORD=true',
        },
      }),
    ], ['true'])).toEqual([]);
  });
});
