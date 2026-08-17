import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import { useAgentProviderStartup } from '../src/startup/use-agent-provider-startup';

describe('agent provider startup generations', () => {
  it.each(['chat', 'session', 'project'] as const)(
    'retries only the failed %s source and leaves healthy sources single-bound',
    async (failedSource) => {
      const calls = { chat: 0, session: 0, project: 0 };
      const initialize = async (source: keyof typeof calls) => {
        calls[source] += 1;
        if (source === failedSource && calls[source] === 1) {
          throw new Error(`${source} failed`);
        }
      };
      const options = {
        platform: platform(),
        config: {} as AgentConfig,
        chatService: { init: () => initialize('chat') },
        sessionService: { init: () => initialize('session') },
        projectService: { init: () => initialize('project') },
      };
      const { result } = renderHook(() => useAgentProviderStartup(options as any));
      await waitFor(() => expect(result.current.state).toMatchObject({
        phase: 'error', source: failedSource,
      }));
      act(() => result.current.retry());
      await waitFor(() => expect(result.current.state.phase).toBe('ready'));
      expect(calls[failedSource]).toBe(2);
      for (const source of ['chat', 'session', 'project'] as const) {
        if (source !== failedSource) expect(calls[source]).toBe(1);
      }
    },
  );

  it('ignores an old provider generation that resolves after a replacement', async () => {
    const old = deferred<void>();
    const fresh = deferred<void>();
    const firstConfig = {} as AgentConfig;
    const secondConfig = {} as AgentConfig;
    const options = {
      platform: platform(),
      config: firstConfig,
      chatService: { init: (_platform: IPlatform, config: AgentConfig) =>
        config === firstConfig ? old.promise : fresh.promise },
      sessionService: { init: vi.fn().mockResolvedValue(undefined) },
      projectService: { init: vi.fn().mockResolvedValue(undefined) },
    };
    const { result, rerender } = renderHook(
      ({ config }) => useAgentProviderStartup({ ...options, config } as any),
      { initialProps: { config: firstConfig } },
    );
    rerender({ config: secondConfig });
    await act(async () => old.resolve());
    expect(result.current.state.phase).toBe('loading');
    await act(async () => fresh.resolve());
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  });
});

function platform(): IPlatform {
  const values = new Map<string, unknown>();
  return {
    type: 'browser',
    storage: {
      get: async <T,>(key: string) => (values.get(key) ?? null) as T | null,
      set: async (key, value) => { values.set(key, value); },
      delete: async (key) => { values.delete(key); },
      list: async () => [...values.keys()],
      clear: async () => { values.clear(); },
    },
  } as IPlatform;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve: () => resolve(undefined as T) };
}
