import { ConfigService } from '@nestjs/config';
import { ServerService } from '../../server/server.service';
import { ServerExecutionInput } from '../server-executor.types';
import { SshLiveServerExecutorAdapter } from './ssh-live.adapter';
import {
  SshTransport,
  SshTransportExecOptions,
} from '../../common/ssh/ssh-transport';
import { SshTransportFactory } from '../../common/ssh/ssh-transport.factory';

/**
 * Fake transport：模拟 ssh2 transport 的 execScript/execCommand，
 * 取代旧 spec 里对 `spawn('ssh')` 的 mock。
 *
 * `execScript` 返回一个测试可控的 deferred：测试可在任意时机
 *  - 通过 `options.onData` 注入远端输出（模拟 PID marker）
 *  - 通过 `resolveExec` 完成 promise（模拟 channel 关闭）
 */
interface FakeTransportHandle {
  script: string;
  options: SshTransportExecOptions;
  resolveExec: (result: { exitCode: number | null; timedOut?: boolean; cancelled?: boolean }) => void;
}

interface FakeTransportControls {
  /** execScript 被调用时，把 handle 推入此回调；测试据此驱动事件。 */
  onExecScript?: (handle: FakeTransportHandle) => void;
  /** execCommand 被调用时返回结果。 */
  onExecCommand?: (command: string) => { exitCode: number | null; stderr: string };
}

function createFakeTransportFactory(controls: FakeTransportControls) {
  const factory = {
    create: jest.fn((): SshTransport => {
      const transport: SshTransport = {
        execScript: jest.fn(
          (script: string, options: SshTransportExecOptions) =>
            new Promise((resolve) => {
              const handle: FakeTransportHandle = {
                script,
                options,
                resolveExec: (result) =>
                  resolve({
                    exitCode: result.exitCode,
                    stdout: '',
                    stderr: '',
                    timedOut: result.timedOut ?? false,
                    cancelled: result.cancelled ?? false,
                  }),
              };
              controls.onExecScript?.(handle);
            }),
        ),
        execCommand: jest.fn(async (command: string) => {
          if (controls.onExecCommand) {
            return controls.onExecCommand(command);
          }
          return { exitCode: 0, stderr: '' };
        }),
        dispose: jest.fn(),
      };
      return transport;
    }),
  };
  return factory as unknown as SshTransportFactory;
}

function createCancellationToken() {
  let requested = false;
  const callbacks = new Set<() => void>();

  return {
    token: {
      isCancellationRequested: () => requested,
      onCancel: (callback: () => void) => {
        callbacks.add(callback);
        return () => callbacks.delete(callback);
      },
    },
    cancel: () => {
      requested = true;
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

interface CredsOverride {
  authType: string;
  credentials: string;
  username?: string;
  host?: string;
  port?: number;
}

function buildDeps(
  controls: FakeTransportControls,
  credsOverride?: CredsOverride,
  liveEnabled: string | boolean = 'true',
) {
  const configService = {
    get: jest.fn((key: string, fallback?: string | number) => {
      if (key === 'SERVER_EXECUTOR_LIVE_ENABLED') return liveEnabled;
      return fallback;
    }),
  } as unknown as ConfigService;
  const serverService = {
    getDecryptedCredentials: jest.fn().mockResolvedValue({
      authType: 'key',
      credentials: 'PRIVATE KEY',
      username: 'deploy',
      host: '10.0.0.10',
      port: 22,
      ...credsOverride,
    }),
  } as unknown as ServerService;
  const sshTransportFactory = createFakeTransportFactory(controls);
  const adapter = new SshLiveServerExecutorAdapter(configService, serverService, sshTransportFactory);
  return { adapter, sshTransportFactory, configService, serverService };
}

describe('SshLiveServerExecutorAdapter remote cancellation (ssh2 transport)', () => {
  it('runs live scripts through a remote session wrapper and best-effort kills the remote process tree on cancel', async () => {
    let capturedHandle: FakeTransportHandle | undefined;
    let killCommand = '';

    const { adapter, sshTransportFactory } = buildDeps({
      onExecScript: (handle) => {
        capturedHandle = handle;
      },
      onExecCommand: (command) => {
        killCommand = command;
        return { exitCode: 0, stderr: '' };
      },
    });

    const cancellation = createCancellationToken();
    const observerEvents: string[] = [];
    let releaseStartedObserver: () => void = () => undefined;
    const startedObserverPersisted = new Promise<void>((resolve) => {
      releaseStartedObserver = () => {
        observerEvents.push('started');
        resolve();
      };
    });
    const runtimeObserver = {
      onRemoteProcessStarted: jest.fn(() => startedObserverPersisted),
      onRemoteProcessCleanup: jest.fn(() => {
        observerEvents.push('cleanup');
      }),
    };
    const input: ServerExecutionInput = {
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: { transport: 'ssh', serverId: 'server-1' },
      steps: [
        { key: 'deploy', label: 'Deploy', command: 'sleep 60', required: true, timeoutSeconds: 30 },
      ],
      requiredConfirmationText: 'Example App',
      confirmationText: 'Example App',
      cancellationToken: cancellation.token,
      runtimeObserver,
    };

    const execution = adapter.execute(input);
    // 等待 transport.execScript 被调用
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 1. 脚本含远端进程治理 marker
    expect(capturedHandle?.script).toContain('setsid bash "$__devpilot_tmp" &');
    expect(capturedHandle?.script).toContain('echo "__DEVPILOT_REMOTE_CHILD_PID__=$__devpilot_child_pid" >&2');
    expect(capturedHandle?.script).toContain('kill -TERM -- "-$__devpilot_child_pid"');

    // 2. 远端报告 PID -> 触发 onRemoteProcessStarted
    capturedHandle!.options.onData?.({ stderr: '__DEVPILOT_REMOTE_CHILD_PID__=4321\n' });
    expect(runtimeObserver.onRemoteProcessStarted).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'ssh',
      pid: 4321,
      serverId: 'server-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      cleanupStrategy: 'best_effort_ssh',
    }));

    // 3. 取消 -> 触发远程 kill
    cancellation.cancel();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(killCommand).toContain('pid=4321');
    expect(killCommand).toContain('kill -TERM -- "-$pid"');
    expect(killCommand).toContain('kill -KILL -- "-$pid"');

    // 4. 完成 execScript（模拟 channel 因取消关闭）
    capturedHandle!.resolveExec({ exitCode: null, cancelled: true });

    releaseStartedObserver();
    const result = await execution;
    const resultPayload = result.result as {
      remoteProcessPid?: number;
      remoteKill?: { attempted?: boolean; reason?: string; succeeded?: boolean };
      stderrPreview?: string;
    };

    expect(result.status).toBe('cancelled');
    expect(resultPayload.remoteProcessPid).toBe(4321);
    expect(resultPayload.remoteKill).toEqual({
      attempted: true,
      reason: 'cancel',
      succeeded: true,
    });
    expect(runtimeObserver.onRemoteProcessCleanup).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'ssh',
      pid: 4321,
      reason: 'cancel',
      attempted: true,
      succeeded: true,
    }));
    expect(observerEvents).toEqual(['started', 'cleanup']);
    expect(resultPayload.stderrPreview).not.toContain('__DEVPILOT_REMOTE_CHILD_PID__');

    // 5. transport 被创建
    expect(sshTransportFactory.create).toHaveBeenCalledTimes(1);
  });

  it('best-effort cleans a persisted remote session for stale recovery', async () => {
    let killCommand = '';
    const { adapter } = buildDeps({
      onExecCommand: (command) => {
        killCommand = command;
        return { exitCode: 0, stderr: '' };
      },
    });
    const input: ServerExecutionInput = {
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: { transport: 'ssh', serverId: 'server-1' },
      steps: [],
    };

    const cleanup = adapter.cleanupRemoteExecutionSession(
      input,
      {
        transport: 'ssh',
        pid: 4321,
        observedAt: '2026-06-27T00:00:01.000Z',
        serverId: 'server-1',
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        cleanupStrategy: 'best_effort_ssh',
      },
      'stale_recovery',
    );

    await expect(cleanup).resolves.toEqual(expect.objectContaining({
      transport: 'ssh',
      pid: 4321,
      reason: 'stale_recovery',
      attempted: true,
      succeeded: true,
    }));
    expect(killCommand).toContain('pid=4321');
    expect(killCommand).toContain('kill -TERM -- "-$pid"');
    expect(killCommand).toContain('kill -KILL -- "-$pid"');
  });
});

const PASSWORD = 'p@ssw0rd-secret';

function buildExecuteInput(overrides: Partial<ServerExecutionInput> = {}): ServerExecutionInput {
  return {
    teamId: 'team-1',
    userId: 'user-1',
    operationKey: 'deployment.run',
    adapterKey: 'deployment-script-plan',
    dryRun: false,
    target: { transport: 'ssh', serverId: 'server-1' },
    steps: [
      { key: 'deploy', label: 'Deploy', command: 'echo hi', required: true, timeoutSeconds: 30 },
    ],
    requiredConfirmationText: 'Example App',
    confirmationText: 'Example App',
    ...overrides,
  };
}

describe('SshLiveServerExecutorAdapter password auth (F383 §A)', () => {
  it('runs a password-auth live execution through the unified credential mapper', async () => {
    let captured: { script: string; transportCreds?: unknown } | undefined;
    let resolveExec: ((r: { exitCode: number | null }) => void) | undefined;
    const { adapter } = buildDeps(
      {
        onExecScript: (handle) => {
          captured = { script: handle.script };
          resolveExec = handle.resolveExec;
        },
      },
      { authType: 'password', credentials: PASSWORD },
    );

    const exec = adapter.execute(buildExecuteInput());
    await new Promise((r) => setTimeout(r, 10));

    // 执行到达 transport（不再被 password 硬拒绝）
    expect(captured?.script).toBeTruthy();
    resolveExec!({ exitCode: 0 });

    const result = await exec;
    expect(result.status).toBe('completed');
    // 安全：密码不出现在结果、脚本计划、warnings
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(PASSWORD);
  });

  it('blocks an unknown authType with an actionable fail-closed message (no crash, no secret)', async () => {
    const { adapter } = buildDeps({}, { authType: 'otp', credentials: 'DO-NOT-LEAK' });
    const result = await adapter.execute(buildExecuteInput());
    expect(result.status).toBe('blocked');
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('不支持认证类型');
    expect(serialized).toContain('key / password');
    expect(serialized).not.toContain('DO-NOT-LEAK');
  });

  it('surfaces SSH auth failure as an actionable execution error (no plaintext)', async () => {
    const { adapter } = buildDeps(
      {
        onExecScript: () => {
          throw new Error('All configured authentication methods failed');
        },
      },
      { authType: 'password', credentials: PASSWORD },
    );
    // onExecScript throw 在 fake 里会 reject execScript promise；adapter 转为 failed。
    const result = await adapter.execute(buildExecuteInput()).catch((e) => ({
      thrown: e instanceof Error ? e.message : String(e),
    }));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(PASSWORD);
    if (typeof result === 'object' && result && 'status' in result) {
      // 落入 failed/blocked 而非 completed
      expect(['failed', 'blocked']).toContain((result as { status: string }).status);
    }
  });

  it('runs stale remote cleanup with password auth through the unified mapper', async () => {
    let killCommand = '';
    const { adapter } = buildDeps(
      {
        onExecCommand: (command) => {
          killCommand = command;
          return { exitCode: 0, stderr: '' };
        },
      },
      { authType: 'password', credentials: PASSWORD },
    );
    const cleanup = await adapter.cleanupRemoteExecutionSession(
      buildExecuteInput(),
      {
        transport: 'ssh',
        pid: 5555,
        observedAt: '2026-07-28T00:00:01.000Z',
        serverId: 'server-1',
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        cleanupStrategy: 'best_effort_ssh',
      },
      'stale_recovery',
    );
    expect(cleanup).toEqual(expect.objectContaining({
      transport: 'ssh',
      pid: 5555,
      reason: 'stale_recovery',
      attempted: true,
      succeeded: true,
    }));
    expect(killCommand).toContain('pid=5555');
    expect(JSON.stringify(cleanup)).not.toContain(PASSWORD);
  });

  it('fails closed on cleanup with unknown authType (actionable, no secret)', async () => {
    const { adapter } = buildDeps(
      { onExecCommand: () => ({ exitCode: 0, stderr: '' }) },
      { authType: 'otp', credentials: 'DO-NOT-LEAK' },
    );
    const cleanup = await adapter.cleanupRemoteExecutionSession(
      buildExecuteInput(),
      {
        transport: 'ssh',
        pid: 5556,
        observedAt: '2026-07-28T00:00:01.000Z',
        serverId: 'server-1',
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        cleanupStrategy: 'best_effort_ssh',
      },
      'stale_recovery',
    );
    expect(cleanup.attempted).toBe(false);
    expect(cleanup.error).toContain('不支持认证类型');
    expect(JSON.stringify(cleanup)).not.toContain('DO-NOT-LEAK');
  });
});
