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
import {
  redactCommandPlanForPersistence,
  stripSecretEnv,
} from './deployment-secret-strip.utils';
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
import { buildServerAgentCommandPlan } from '../server-executor/adapters/server-agent-dispatch-plan.utils';
import {
  buildServerAgentCancelledResult,
  buildServerAgentDryRunResult,
  buildServerAgentBlockedResult,
  buildServerAgentDispatchFailureResult,
} from '../server-executor/adapters/server-agent-dispatch-result.utils';
import { buildServerAgentDispatchSuccessResult } from '../server-executor/adapters/server-agent-dispatch-success-result.utils';
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

/** Recursively assert no `secretEnv` / `secretEnvExport` key exists anywhere in a serialized value. */
function assertNoSecretEnv(value: unknown, path = 'root') {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((item, i) => assertNoSecretEnv(item, `${path}[${i}]`));
    } else {
      expect(value).not.toHaveProperty('secretEnv');
      expect(value).not.toHaveProperty('secretEnvExport');
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

  // F383 P0-A regression: secretEnvExport (release-stage credential injection)
  // MUST be stripped alongside secretEnv — it carries the same plaintext secret class.
  it('removes secretEnvExport from steps that carry it', () => {
    const steps: ServerExecutionInput['steps'] = [
      {
        key: 'migration',
        label: 'migration',
        command: 'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app',
        cwd: '',
        required: true,
        secretEnvExport: { DEVPILOT_DATABASE_URL: SECRET_PASSWORD },
      },
    ];
    const stripped = stripSecretEnv(steps);
    expect(stripped[0]).not.toHaveProperty('secretEnvExport');
    expect(stripped[0]).not.toHaveProperty('secretEnv');
    expect(JSON.stringify(stripped)).not.toContain(SECRET_PASSWORD);
    // The placeholder command is retained (it is safe to persist).
    expect(stripped[0].command).toContain('$DEVPILOT_DATABASE_URL');
  });

  it('strips both secretEnv and secretEnvExport when a step carries both', () => {
    const steps: ServerExecutionInput['steps'] = [
      {
        key: 'mixed',
        label: 'mixed',
        command: 'echo ok',
        cwd: '',
        required: true,
        secretEnv: { DATABASE_URL: SECRET_PASSWORD },
        secretEnvExport: { DEVPILOT_REDIS: 'redis-secret' },
      },
    ];
    const stripped = stripSecretEnv(steps);
    expect(stripped[0]).not.toHaveProperty('secretEnv');
    expect(stripped[0]).not.toHaveProperty('secretEnvExport');
    expect(JSON.stringify(stripped)).not.toContain(SECRET_PASSWORD);
    expect(JSON.stringify(stripped)).not.toContain('redis-secret');
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

/**
 * DEP-1（2026-08-22 走查 P0）：历史已阻塞运行的命令计划在 `step.command`
 * 文本里明文携带 DATABASE_URL 密码 / JWT_SECRET / BOOTSTRAP_ADMIN_PASSWORD。
 * 回归契约：凡含 secret 的输入，经任一持久化入口后输出必须全为 REDACTED
 * 标记——既不能出现明文值，也不能靠展示层兜底。
 */
describe('DEP-1 regression: plaintext secrets inside step.command are scrubbed at persistence', () => {
  const LEAKED_DSN =
    'mysql://user_db_picshare:65a75047aeb000b0f79bc59af9c7fdf1@10.0.0.1:3306/picshare';
  const LEAKED_JWT_SECRET = 'f383-picshare-jwt-secret-dev';
  const LEAKED_ADMIN_PASSWORD = 'f383-bootstrap-admin-pwd-dev';

  /** 复刻 2026-07-29 泄露运行的 write_env 步骤：heredoc 命令本身携带真实值。 */
  function stepsWithPlaintextCommand(): ServerExecutionInput['steps'] {
    return [
      {
        key: 'write_env',
        label: '写入环境配置',
        command: `cat > .env <<'DEVPILOT_ENV_EOF'\nDATABASE_URL=${LEAKED_DSN}\nJWT_SECRET=${LEAKED_JWT_SECRET}\nBOOTSTRAP_ADMIN_PASSWORD=${LEAKED_ADMIN_PASSWORD}\nDEVPILOT_ENV_EOF`,
        cwd: '/srv/app',
        required: true,
      },
    ];
  }

  function expectFullyRedacted(serialized: string) {
    expect(serialized).not.toContain(LEAKED_DSN);
    expect(serialized).not.toContain('65a75047aeb000b0f79bc59af9c7fdf1');
    expect(serialized).not.toContain(LEAKED_JWT_SECRET);
    expect(serialized).not.toContain(LEAKED_ADMIN_PASSWORD);
    expect(serialized).toContain('[REDACTED]');
  }

  it('redactCommandPlanForPersistence scrubs DSN password, JWT secret and admin password from the command text', () => {
    const persisted = redactCommandPlanForPersistence(stepsWithPlaintextCommand());
    const serialized = JSON.stringify(persisted);
    expectFullyRedacted(serialized);
    // 键名必须保留：reapplyDeploymentEnvWriteSecrets 依赖从脱敏命令提取 KEY
    // 在执行边界重解析真实值。
    expect(persisted[0].command).toContain('DATABASE_URL=');
    expect(persisted[0].command).toContain('JWT_SECRET=');
    expect(persisted[0].command).toContain('BOOTSTRAP_ADMIN_PASSWORD=');
  });

  it('is idempotent for already-redacted write_env commands and keeps $DEVPILOT_* placeholders intact', () => {
    const steps = stepsWithSecret(); // buildEnvWriteStep 产物：值已是 ***REDACTED***
    const persisted = redactCommandPlanForPersistence(steps);
    expect(persisted[0].command).toContain('DATABASE_URL=***REDACTED***');

    const placeholderSteps: ServerExecutionInput['steps'] = [
      {
        key: 'migration',
        label: 'migration',
        command: 'docker run -e JWT_SECRET="$DEVPILOT_JWT_SECRET" app',
        cwd: '',
        required: true,
      },
    ];
    const out = redactCommandPlanForPersistence(placeholderSteps);
    expect(out[0].command).toBe('docker run -e JWT_SECRET="$DEVPILOT_JWT_SECRET" app');
  });

  it('every persisted result/snapshot builder redacts plaintext commands (DEP-1)', () => {
    const input = makeInput({ dryRun: true, steps: stepsWithPlaintextCommand() });

    const cancelled = buildServerExecutorCancelledResult(input);
    expectFullyRedacted(JSON.stringify(cancelled));

    const queued = buildServerExecutorQueuedResult(input, {
      id: 'job-1',
      queuedAt: new Date('2026-01-01T00:00:00Z'),
      availableAt: new Date('2026-01-01T00:00:00Z'),
    });
    expectFullyRedacted(JSON.stringify(queued));

    const policy: ServerCommandPolicyResult = {
      status: 'blocked',
      policyKey: 'baseline',
      mode: 'built_in_baseline',
      decisions: [],
      warnings: [],
      blockedReasons: ['blocked'],
    };
    const policyBlocked = buildServerExecutorPolicyBlockedResult(input, policy);
    expectFullyRedacted(JSON.stringify(policyBlocked));

    const concurrencyBlocked = buildServerExecutorConcurrencyBlockedResult(input, null, 'lease-1');
    expectFullyRedacted(JSON.stringify(concurrencyBlocked));

    const snapshot = buildServerExecutionInputSnapshot(input);
    expectFullyRedacted(JSON.stringify(snapshot));

    const plan = buildSshLivePlan(input, [], true);
    expectFullyRedacted(JSON.stringify(plan));
  });

  it('server-agent adapter plan and result builders never persist plaintext secrets (DEP-1 bypass)', () => {
    // server-agent 适配器是 DEP-1 修复的旁路缺口：队列边界重解析后的真实
    // secretEnvExport/明文命令会进入 buildServerAgentCommandPlan 与各 result
    // builder 的 steps。regression：任一构建器输出都不得含明文。
    const agentInput = makeInput({
      dryRun: false,
      target: {
        transport: 'server_agent',
        serverId: 's-1',
        agentRef: {
          source: 'server_services',
          referenceId: 'ref-1',
          displayName: 'agent-1',
          capabilityKey: 'server_agent_executor_v1',
          redacted: true,
        },
      },
      steps: stepsWithPlaintextCommand(),
    });
    const plan = buildServerAgentCommandPlan(agentInput, [], true, true, true);
    expectFullyRedacted(JSON.stringify(plan));

    const cancelled = buildServerAgentCancelledResult(agentInput, plan, []);
    expectFullyRedacted(JSON.stringify(cancelled));

    const dryRun = buildServerAgentDryRunResult(
      agentInput, plan, [], true,
      { agentExecutorEnabled: true, dispatcherConfigured: true },
    );
    expectFullyRedacted(JSON.stringify(dryRun));

    const blocked = buildServerAgentBlockedResult(
      agentInput, plan, [], 'blocked', 
      { agentExecutorEnabled: true, dispatcherConfigured: true },
    );
    expectFullyRedacted(JSON.stringify(blocked));

    const failed = buildServerAgentDispatchFailureResult(
      agentInput, plan, [], 'http://dispatcher', 'dispatch failed',
    );
    expectFullyRedacted(JSON.stringify(failed));

    const success = buildServerAgentDispatchSuccessResult(
      agentInput, plan, [], 'http://dispatcher', {},
      { status: 'completed', responseWarnings: [], logs: [], result: {} },
    );
    expectFullyRedacted(JSON.stringify(success));

    // 键名保留：$DEVPILOT_* 占位契约与 KEY= 提取不受影响。
    const serialized = JSON.stringify(plan);
    expect(serialized).toContain('DATABASE_URL=');
    expect(serialized).not.toContain('secretEnv');
    expect(serialized).not.toContain('secretEnvExport');
  });
});
