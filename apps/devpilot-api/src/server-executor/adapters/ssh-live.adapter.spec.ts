import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { ServerService } from '../../server/server.service';
import { ServerExecutionInput } from '../server-executor.types';
import { SshLiveServerExecutorAdapter } from './ssh-live.adapter';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

type FakeChild = EventEmitter & {
  stdin: EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
  };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdin = new EventEmitter() as FakeChild['stdin'];
  child.stdin.write = jest.fn();
  child.stdin.end = jest.fn();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  return child;
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

async function waitForSpawnCount(spawns: { child: FakeChild; args: string[] }[], count: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (spawns.length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Expected ${count} spawn calls, saw ${spawns.length}`);
}

describe('SshLiveServerExecutorAdapter remote cancellation', () => {
  const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('runs live scripts through a remote session wrapper and best-effort kills the remote process tree on cancel', async () => {
    const spawns: { child: FakeChild; args: string[] }[] = [];
    spawnMock.mockImplementation(((_command: string, args: string[]) => {
      const child = createFakeChild();
      spawns.push({ child, args });
      return child;
    }) as never);

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
    const adapter = new SshLiveServerExecutorAdapter(configService, serverService);
    const input: ServerExecutionInput = {
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: {
        transport: 'ssh',
        serverId: 'server-1',
      },
      steps: [
        {
          key: 'deploy',
          label: 'Deploy',
          command: 'sleep 60',
          required: true,
          timeoutSeconds: 30,
        },
      ],
      requiredConfirmationText: 'Example App',
      confirmationText: 'Example App',
      cancellationToken: cancellation.token,
      runtimeObserver,
    };

    const execution = adapter.execute(input);
    await waitForSpawnCount(spawns, 1);

    const main = spawns[0];
    const remoteWrapper = main.child.stdin.write.mock.calls[0][0] as string;
    expect(main.args.at(-1)).toBe('bash -se');
    expect(remoteWrapper).toContain('setsid bash "$__devpilot_tmp" &');
    expect(remoteWrapper).toContain('echo "__DEVPILOT_REMOTE_CHILD_PID__=$__devpilot_child_pid" >&2');
    expect(remoteWrapper).toContain('kill -TERM -- "-$__devpilot_child_pid"');

    main.child.stderr.emit('data', Buffer.from('__DEVPILOT_REMOTE_CHILD_PID__=4321\n'));
    expect(runtimeObserver.onRemoteProcessStarted).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'ssh',
      pid: 4321,
      serverId: 'server-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      cleanupStrategy: 'best_effort_ssh',
    }));
    cancellation.cancel();
    await waitForSpawnCount(spawns, 2);

    const cleanup = spawns[1];
    expect(main.child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(cleanup.args.at(-1)).toContain('pid=4321');
    expect(cleanup.args.at(-1)).toContain('kill -TERM -- "-$pid"');
    expect(cleanup.args.at(-1)).toContain('kill -KILL -- "-$pid"');

    cleanup.child.emit('close', 0);
    main.child.emit('close', null);
    await new Promise((resolve) => setImmediate(resolve));
    expect(runtimeObserver.onRemoteProcessCleanup).not.toHaveBeenCalled();
    releaseStartedObserver();
    const result = await execution;
    const resultPayload = result.result as {
      remoteProcessPid?: number;
      remoteKill?: {
        attempted?: boolean;
        reason?: string;
        succeeded?: boolean;
      };
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
  });

  it('best-effort cleans a persisted remote session for stale recovery', async () => {
    const spawns: { child: FakeChild; args: string[] }[] = [];
    spawnMock.mockImplementation(((_command: string, args: string[]) => {
      const child = createFakeChild();
      spawns.push({ child, args });
      return child;
    }) as never);

    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
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
    const adapter = new SshLiveServerExecutorAdapter(configService, serverService);
    const input: ServerExecutionInput = {
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: {
        transport: 'ssh',
        serverId: 'server-1',
      },
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
    await waitForSpawnCount(spawns, 1);

    const cleanupSsh = spawns[0];
    expect(cleanupSsh.args.at(-1)).toContain('pid=4321');
    expect(cleanupSsh.args.at(-1)).toContain('kill -TERM -- "-$pid"');
    expect(cleanupSsh.args.at(-1)).toContain('kill -KILL -- "-$pid"');

    cleanupSsh.child.emit('close', 0);
    await expect(cleanup).resolves.toEqual(expect.objectContaining({
      transport: 'ssh',
      pid: 4321,
      reason: 'stale_recovery',
      attempted: true,
      succeeded: true,
    }));
  });
});
