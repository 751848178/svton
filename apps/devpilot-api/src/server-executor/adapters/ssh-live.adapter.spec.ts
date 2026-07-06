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

describe('SshLiveServerExecutorAdapter remote cancellation (ssh2 transport)', () => {
  function buildDeps(controls: FakeTransportControls) {
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'SERVER_EXECUTOR_LIVE_ENABLED') return 'true';
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
      }),
    } as unknown as ServerService;
    const sshTransportFactory = createFakeTransportFactory(controls);
    const adapter = new SshLiveServerExecutorAdapter(configService, serverService, sshTransportFactory);
    return { adapter, sshTransportFactory, configService, serverService };
  }

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
