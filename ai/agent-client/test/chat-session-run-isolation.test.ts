import { describe, expect, it, vi } from 'vitest';
import type { PublicRuntimeEvent, SvtonAgentRuntime } from '@svton/agent-core';
import { ChatService } from '../src/service/chat.service';
import {
  buildPiAgentConfig,
  makeBrowserPlatform,
  nativeAgentEnd,
  nativeError,
  nativeTextDelta,
} from './helpers/pi-test-utils';
import {
  deferred,
  expectSingleTurn,
  runtimeFor,
  runScript,
  select,
} from './helpers/chat-concurrent-test-utils';

describe('session run isolation', () => {
  it('keeps completed B sendable when returned to from a new live A turn', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    runScript(runtimeFor(service, 'a'), async function* () {
      yield nativeTextDelta('A ready') as PublicRuntimeEvent;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    await service.sendMessage('prepare A');
    await select(service, 'b');
    runScript(runtimeFor(service, 'b'), async function* () {
      yield nativeTextDelta('B ready') as PublicRuntimeEvent;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    await service.sendMessage('prepare B');

    await select(service, 'a');
    const holdA = deferred();
    runScript(runtimeFor(service, 'a'), async function* () {
      await holdA.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('hold A');
    await select(service, 'b');

    expect(service.status).toBe('idle');
    expect(service.isStreaming).toBe(false);
    expect(service.canSend).toBe(true);
    holdA.resolve();
    await sendA;
  });

  it('aborts only the selected owner while the other session remains live', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    const runtimeA = runtimeFor(service, 'a');
    const finishA = deferred();
    runScript(runtimeA, async function* () {
      await finishA.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('hold A');
    await select(service, 'b');
    const runtimeB = runtimeFor(service, 'b');
    const finishB = deferred();
    runScript(runtimeB, async function* () {
      await finishB.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendB = service.sendMessage('hold B');

    await select(service, 'a');
    expect(service.abortSession('a')).toBe(true);
    expect(service.getSessionRunState('a')?.phase).toBe('interrupted');
    expect(service.getSessionRunState('b')?.phase).toBe('inProgress');
    expect(service.getPendingUserInput()).toBeNull();
    finishA.resolve();
    await sendA;
    await select(service, 'b');
    expect(service.status).toBe('running');
    expect(service.abortSession('b')).toBe(true);
    expect(service.getSessionRunState('a')?.phase).toBe('interrupted');
    finishB.resolve();
    await sendB;
  });

  it('keeps selected B running when background A fails at the provider boundary', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    const runtimeA = runtimeFor(service, 'a');
    const failA = deferred();
    runScript(runtimeA, async function* () {
      await failA.promise;
      yield nativeError('A provider failed') as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('fail A');

    await select(service, 'b');
    const runtimeB = runtimeFor(service, 'b');
    const finishB = deferred();
    runScript(runtimeB, async function* () {
      yield nativeTextDelta('B remains live') as PublicRuntimeEvent;
      await finishB.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendB = service.sendMessage('hold B');
    await vi.waitFor(() => expectSingleTurn(service.messages, 'hold B', 'B remains live'));
    const visibleBeforeFailure = service.messages.map((message) => ({ ...message }));

    failA.resolve();
    await sendA;
    expect(service.getSessionRunState('a')).toMatchObject({
      phase: 'failed', error: { message: 'A provider failed' },
    });
    expect(service.getSessionRunState('b')?.phase).toBe('inProgress');
    expect(service.status).toBe('running');
    expect(service.messages).toEqual(visibleBeforeFailure);
    expect(service.canSend).toBe(false);
    const cachedA = service.getCachedMessages('a') ?? [];
    expectSingleTurn(cachedA, 'fail A');
    expect(cachedA.find((message) => message.role === 'assistant')?.error)
      .toContain('A provider failed');

    finishB.resolve();
    await sendB;
    expect(service.getSessionRunState('b')?.phase).toBe('completed');
  });

  it('publishes Stop synchronously for slow creation and aborts before run', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'slow');
    const existingRuntime = runtimeFor(service, 'slow');
    const abortExisting = vi.spyOn(existingRuntime, 'abort');
    const pending = deferred<SvtonAgentRuntime>();
    const registry = Reflect.get(service, 'runtimeRegistry') as {
      ensureCurrent: (owner: string | null) => Promise<SvtonAgentRuntime>;
      cancelPending: (owner: string | null) => boolean;
    };
    vi.spyOn(registry, 'ensureCurrent').mockReturnValue(pending.promise);
    vi.spyOn(registry, 'cancelPending').mockReturnValue(true);
    const runtime = {
      run: vi.fn(async function* () {}), getMessages: vi.fn(() => []),
      abort: vi.fn(), reset: vi.fn(),
    } as unknown as SvtonAgentRuntime;

    const first = service.sendMessage('slow user');
    const duplicate = service.sendMessage('duplicate');
    expect(service.getSessionRunState('slow')?.phase).toBe('inProgress');
    expect(service.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(expectSingleTurn(service.messages, 'slow user').isStreaming).toBe(true);
    expect(service.canSend).toBe(false);
    await duplicate;
    expect(service.messages.filter((message) => message.role === 'user')).toHaveLength(1);

    service.bindSession('b');
    expect(service.canSend).toBe(true);
    service.bindSession('slow');
    expect(service.abortSession('slow')).toBe(true);
    expect(service.getSessionRunState('slow')?.phase).toBe('interrupted');
    expect(service.canSend).toBe(true);
    pending.resolve(runtime);
    await first;
    expect(abortExisting).not.toHaveBeenCalled();
    expect(runtime.run).not.toHaveBeenCalled();
  });
});
