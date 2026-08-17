import { describe, expect, it, vi } from 'vitest';
import { runPostTurnHooks } from '../src/agent/runtime-lifecycle';
import { publishRuntimeEventAfterSettlement } from '../src/agent/runtime-terminal-publication';
import { nativeAgentEnd } from './helpers';

describe('authoritative runtime settlement', () => {
  it('publishes agent_end exactly once and only after post-turn settlement', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const published: string[] = [];
    const terminal = publishRuntimeEventAfterSettlement(
      nativeAgentEnd(),
      () => held,
      (event) => published.push(event.type),
    );
    await Promise.resolve();
    expect(published).toEqual([]);
    release();
    await terminal;
    expect(published).toEqual(['agent_end']);
  });

  it('does not run terminal settlement for non-terminal events', async () => {
    const settle = vi.fn(async () => {});
    const publish = vi.fn();
    await publishRuntimeEventAfterSettlement({ type: 'turn_start' }, settle, publish);
    expect(settle).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledOnce();
  });

  it('aborts bounded memory work and checkpoints the exact run revision', async () => {
    let capturedSignal: AbortSignal | undefined;
    const memoryManager = {
      extractFromConversation: vi.fn((_messages, _provider, _model, signal) => {
        capturedSignal = signal;
        return new Promise<number>(() => {});
      }),
    };
    const checkpoint = vi.fn(async () => {});
    const runtime = { setMessages: vi.fn() };
    const messages = [
      { role: 'user', content: 'one', timestamp: 1 },
      { role: 'assistant', content: [], timestamp: 2 },
      { role: 'user', content: 'two', timestamp: 3 },
      { role: 'assistant', content: [], timestamp: 4 },
    ];
    await runPostTurnHooks({
      memoryManager: memoryManager as never,
      models: {} as never,
      model: {} as never,
      modelId: 'model',
      resumeManager: { checkpoint } as never,
      runtime: runtime as never,
      getMessages: () => messages as never,
      memoryTimeoutMs: 5,
    }, 'stop', 'session-a', 7);
    expect(capturedSignal?.aborted).toBe(true);
    expect(checkpoint).toHaveBeenCalledWith('session-a', runtime, 7);
  });
});
