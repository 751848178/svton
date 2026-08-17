import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  failStartup,
  normalizeStartupCause,
  settleStartup,
} from '../src/startup/startup-state';
import { useStartupTask } from '../src/startup/use-startup-task';

describe('startup state', () => {
  it('normalizes ready, no-configuration, and secret-safe retryable errors', () => {
    expect(settleStartup('config', 1, { kind: 'ready', value: 42 }))
      .toMatchObject({ phase: 'ready', value: 42 });
    expect(settleStartup('config', 2, { kind: 'noConfiguration', cause: 'missing key' }))
      .toMatchObject({ phase: 'noConfiguration', cause: 'missing key' });
    const secret = 'abcdefghijklmnopqrstuvwx';
    const error = failStartup('provider', 3, new Error(`api_key=${secret} failed`));
    expect(error).toMatchObject({ phase: 'error', retryable: true });
    expect(error.phase === 'error' && error.cause).not.toContain(secret);
    expect(normalizeStartupCause('a\n b')).toBe('a b');
  });

  it('retries in place and ignores stale success from an older generation', async () => {
    const first = deferred<{ kind: 'ready'; value: string }>();
    const second = deferred<{ kind: 'ready'; value: string }>();
    const { result, rerender } = renderHook(
      ({ generationKey }) => useStartupTask({
        source: 'config',
        generationKey,
        load: () => generationKey === 'a' ? first.promise : second.promise,
      }),
      { initialProps: { generationKey: 'a' } },
    );
    rerender({ generationKey: 'b' });
    await act(async () => first.resolve({ kind: 'ready', value: 'stale' }));
    expect(result.current.state.phase).toBe('loading');
    await act(async () => second.resolve({ kind: 'ready', value: 'fresh' }));
    await waitFor(() => expect(result.current.state).toMatchObject({
      phase: 'ready', value: 'fresh',
    }));
  });

  it('ignores stale failure and a failed generation can retry to ready', async () => {
    let attempt = 0;
    const old = deferred<{ kind: 'ready'; value: string }>();
    const { result, rerender } = renderHook(
      ({ generationKey }) => useStartupTask({
        source: 'session',
        generationKey,
        load: async () => {
          attempt += 1;
          if (generationKey === 'old') return old.promise;
          if (attempt === 2) throw new Error('session failed');
          return { kind: 'ready', value: 'ready' } as const;
        },
      }),
      { initialProps: { generationKey: 'old' } },
    );
    await waitFor(() => expect(attempt).toBe(1));
    rerender({ generationKey: 'new' });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    await act(async () => old.reject(new Error('stale')));
    expect(result.current.state.phase).toBe('error');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(attempt).toBe(3);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

void React;
