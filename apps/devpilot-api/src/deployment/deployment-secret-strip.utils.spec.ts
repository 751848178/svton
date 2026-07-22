/**
 * Regression tests for F1/F2: `secretEnv` (plaintext DB/Redis passwords) MUST
 * NOT appear in any persisted serialization of `steps` — neither the
 * `commandPlan` JSON column nor the `serverExecutionJob.inputSnapshot` column
 * (the latter is exposed via the job-detail API).
 *
 * These tests are the explicit guard the CR asked for; they fail on the
 * pre-fix code because every builder serialized `steps` wholesale.
 */
import { buildEnvWriteStep } from './deployment-env-injection.utils';
import { stripSecretEnv } from './deployment-secret-strip.utils';
import {
  buildServerExecutionInputSnapshot,
} from '../server-executor/server-executor-input-snapshot.utils';
import {
  buildServerExecutorCancelledResult,
  buildServerExecutorQueuedResult,
} from '../server-executor/server-executor-result.utils';
import {
  buildServerExecutorPolicyBlockedResult,
  buildServerExecutorConcurrencyBlockedResult,
} from '../server-executor/server-executor-blocked-result.utils';
import { ScriptPlanServerExecutorAdapter } from '../server-executor/adapters/script-plan.adapter';
import {
  buildSshLivePlan,
  buildSshLiveBlockedResult,
  buildSshLiveCancelledResult,
} from '../server-executor/adapters/ssh-live-result.utils';
import { buildSshLiveExecutedResult } from '../server-executor/adapters/ssh-live-completed-result.utils';
import type {
  ServerCommandPolicyResult,
  ServerExecutionInput,
} from '../server-executor/server-executor.types';

const SECRET_PASSWORD = 'mysql://SUPER:SECRET:PASSWORD@host/db';

/** Steps that carry a real plaintext credential in `secretEnv`. */
function stepsWithSecret(): ServerExecutionInput['steps'] {
  return [
    buildEnvWriteStep('/srv/app', { DATABASE_URL: SECRET_PASSWORD }),
    { key: 'deploy', label: 'deploy', command: 'echo hi', cwd: '/srv/app', required: true, risk: 'medium' },
  ];
}

function makeInput(overrides: Partial<ServerExecutionInput> = {}): ServerExecutionInput {
  return {
    teamId: 'team-1',
    userId: 'user-1',
    operationKey: 'deployment.run',
    adapterKey: 'deployment-script-plan',
    dryRun: true,
    target: { transport: 'ssh', serverId: 's-1', serverHost: 'h', port: 22, username: 'u', authType: 'key' },
    steps: stepsWithSecret(),
    warnings: [],
    metadata: {},
    ...overrides,
  };
}

/** Recursively assert no `secretEnv` key exists anywhere in a serialized value. */
function assertNoSecretEnv(value: unknown, path = 'root') {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((item, i) => assertNoSecretEnv(item, `${path}[${i}]`));
    } else {
      expect(value).not.toHaveProperty('secretEnv');
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        assertNoSecretEnv(v, `${path}.${k}`);
      }
    }
  }
}

describe('stripSecretEnv', () => {
  it('removes secretEnv from every step that carries it', () => {
    const stripped = stripSecretEnv(stepsWithSecret());
    expect(stripped).toHaveLength(2);
    for (const step of stripped) {
      expect(step).not.toHaveProperty('secretEnv');
    }
  });

  it('preserves the redacted command (no real secret leaks via command)', () => {
    const stripped = stripSecretEnv(stepsWithSecret());
    const writeStep = stripped.find((s) => s.key === 'write_env')!;
    expect(writeStep.command).toContain('***REDACTED***');
    expect(writeStep.command).not.toContain(SECRET_PASSWORD);
  });

  it('does not mutate the input (real secretEnv still present on original)', () => {
    const original = stepsWithSecret();
    stripSecretEnv(original);
    expect(original[0].secretEnv).toEqual({ DATABASE_URL: SECRET_PASSWORD });
  });

  it('returns the same step references when no step has secretEnv', () => {
    const steps: ServerExecutionInput['steps'] = [
      { key: 'a', label: 'a', command: 'echo a', cwd: '', required: true },
    ];
    expect(stripSecretEnv(steps)[0]).toBe(steps[0]);
  });
});

describe('F1 regression: commandPlan builders never serialize secretEnv', () => {
  const input = makeInput();

  it('buildServerExecutorCancelledResult', () => {
    const result = buildServerExecutorCancelledResult(input);
    assertNoSecretEnv(result.commandPlan, 'commandPlan');
    assertNoSecretEnv(result.commandSteps, 'commandSteps');
    expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
  });

  it('buildServerExecutorQueuedResult', () => {
    const result = buildServerExecutorQueuedResult(input, {
      id: 'job-1',
      queuedAt: new Date('2026-01-01T00:00:00Z'),
      availableAt: new Date('2026-01-01T00:00:00Z'),
    });
    assertNoSecretEnv(result.commandPlan, 'commandPlan');
    assertNoSecretEnv(result.commandSteps, 'commandSteps');
    expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
  });

  it('buildServerExecutorPolicyBlockedResult', () => {
    const policy: ServerCommandPolicyResult = {
      status: 'blocked',
      policyKey: 'baseline',
      mode: 'built_in_baseline',
      decisions: [],
      warnings: [],
      blockedReasons: ['blocked'],
    };
    const result = buildServerExecutorPolicyBlockedResult(input, policy);
    assertNoSecretEnv(result.commandPlan, 'commandPlan');
    assertNoSecretEnv(result.commandSteps, 'commandSteps');
    expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
  });

  it('buildServerExecutorConcurrencyBlockedResult', () => {
    const result = buildServerExecutorConcurrencyBlockedResult(input, null, 'lease-1');
    assertNoSecretEnv(result.commandPlan, 'commandPlan');
    assertNoSecretEnv(result.commandSteps, 'commandSteps');
    expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
  });

  it('ScriptPlanServerExecutorAdapter (dry-run + blocked + cancelled)', async () => {
    const adapter = new ScriptPlanServerExecutorAdapter();
    const dryRun = await adapter.execute(makeInput({ dryRun: true }));
    assertNoSecretEnv(dryRun.commandPlan, 'commandPlan');
    assertNoSecretEnv(dryRun.commandSteps, 'commandSteps');
    expect(JSON.stringify(dryRun)).not.toContain(SECRET_PASSWORD);

    const blocked = await adapter.execute(makeInput({ dryRun: false }));
    assertNoSecretEnv(blocked.commandPlan, 'commandPlan');
    assertNoSecretEnv(blocked.commandSteps, 'commandSteps');
    expect(JSON.stringify(blocked)).not.toContain(SECRET_PASSWORD);

    const cancelled = await adapter.execute(
      makeInput({ dryRun: true, cancellationToken: { isCancellationRequested: () => true, onCancel: () => () => undefined } }),
    );
    assertNoSecretEnv(cancelled.commandPlan, 'commandPlan');
    assertNoSecretEnv(cancelled.commandSteps, 'commandSteps');
    expect(JSON.stringify(cancelled)).not.toContain(SECRET_PASSWORD);
  });
});

describe('F1 regression: SSH-live result builders never serialize secretEnv', () => {
  const input = makeInput({ dryRun: false });

  it('buildSshLivePlan + buildSshLiveBlockedResult + buildSshLiveCancelledResult', () => {
    const plan = buildSshLivePlan(input, [], true);
    assertNoSecretEnv(plan, 'commandPlan');
    expect(JSON.stringify(plan)).not.toContain(SECRET_PASSWORD);

    const blocked = buildSshLiveBlockedResult(input, plan, [], 'err');
    assertNoSecretEnv(blocked.commandSteps, 'commandSteps');
    expect(JSON.stringify(blocked)).not.toContain(SECRET_PASSWORD);

    const cancelled = buildSshLiveCancelledResult(input, plan, [], { exitCode: 130, stdout: '', stderr: '', timedOut: false, cancelled: true });
    assertNoSecretEnv(cancelled.commandSteps, 'commandSteps');
    expect(JSON.stringify(cancelled)).not.toContain(SECRET_PASSWORD);
  });

  it('buildSshLiveExecutedResult', () => {
    const plan = buildSshLivePlan(input, [], true);
    const executed = buildSshLiveExecutedResult(input, plan, [], true, {
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      timedOut: false,
      cancelled: false,
    });
    assertNoSecretEnv(executed.commandSteps, 'commandSteps');
    expect(JSON.stringify(executed)).not.toContain(SECRET_PASSWORD);
  });
});

describe('F2 regression: inputSnapshot (exposed via API) never serializes secretEnv', () => {
  it('buildServerExecutionInputSnapshot omits secretEnv', () => {
    const snapshot = buildServerExecutionInputSnapshot(makeInput());
    assertNoSecretEnv(snapshot, 'inputSnapshot');
    expect(JSON.stringify(snapshot)).not.toContain(SECRET_PASSWORD);
    // The step's redacted command IS present; the real secret is NOT.
    const steps = (snapshot as { steps: unknown[] }).steps;
    expect(steps).toHaveLength(2);
    for (const step of steps) {
      expect(step).not.toHaveProperty('secretEnv');
    }
  });
});
