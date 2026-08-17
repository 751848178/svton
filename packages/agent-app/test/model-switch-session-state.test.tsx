import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { encodeModelKey, type ModelSwitchHost } from '@svton/agent-client';

const mocked = vi.hoisted(() => ({
  sessionId: 'a' as string | null,
  currentModelKey: null as { providerId: string; modelId: string } | null,
  currentReasoningEffort: undefined as 'low' | 'medium' | 'high' | 'xhigh' | undefined,
  chatService: null as unknown,
}));

vi.mock('@svton/agent-client', async () => {
  const actual = await vi.importActual<typeof import('@svton/agent-client')>('@svton/agent-client');
  return {
    ...actual,
    useAgentContext: () => ({ chatService: mocked.chatService }),
    useChat: () => ({
      currentModelKey: mocked.currentModelKey,
      currentReasoningEffort: mocked.currentReasoningEffort,
    }),
  };
});

import { LiveModelRegistry } from '../src/models/model-registry';
import { useModelSwitch } from '../src/models/use-model-switch';
import { useAgentShellModelControl } from '../src/components/use-agent-shell-model-control';

const a1 = { providerId: 'provider-a', modelId: 'a-1' };
const a2 = { providerId: 'provider-a', modelId: 'a-2' };
const b1 = { providerId: 'provider-b', modelId: 'b-1' };
const b2 = { providerId: 'provider-b', modelId: 'b-2' };

describe('useModelSwitch session projection', () => {
  it('keeps A background completion out of B and restores A result on return', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    mocked.currentModelKey = a1;
    mocked.sessionId = 'a';
    mocked.chatService = {
      get activeSessionId() { return mocked.sessionId; },
      runtimeSettings: {
        getModelSwitchBlockedReason: () => null,
        switchModel: vi.fn(async (request, _host, publish) => {
          publish('preparing', request);
          await wait;
          publish('succeeded', request);
          return {
            kind: 'succeeded', requestId: request.requestId,
            active: request.to, persisted: request.to,
          };
        }),
        retryModelDefaultPersistence: vi.fn(),
      },
    };
    const registry = new LiveModelRegistry([
      {
        id: 'provider-a', name: 'Provider A', type: 'openai',
        models: [{ id: 'a-1', name: 'A One' }, { id: 'a-2', name: 'A Two' }],
      },
      {
        id: 'provider-b', name: 'Provider B', type: 'anthropic',
        models: [{ id: 'b-1', name: 'B One' }],
      },
    ]);
    const host = {
      getPersisted: () => a1,
      prepareConfig: vi.fn(),
      persistDefault: vi.fn(),
    } as unknown as ModelSwitchHost;
    const hook = renderHook(() => useModelSwitch({
      registry, host, initialActive: a1, reasoningEffort: undefined,
    }));
    let selection!: Promise<void>;
    act(() => { selection = hook.result.current.select(encodeModelKey(a2)) as Promise<void>; });
    expect(hook.result.current.phase).toBe('preparing');

    mocked.sessionId = 'b';
    mocked.currentModelKey = b1;
    hook.rerender();
    expect(hook.result.current.activeValue).toBe(encodeModelKey(b1));
    expect(hook.result.current.activeLabel).toContain('B One');
    expect(hook.result.current.phase).toBe('idle');

    await act(async () => { release(); await selection; });
    expect(hook.result.current.activeValue).toBe(encodeModelKey(b1));
    expect(hook.result.current.activeLabel).toContain('B One');
    expect(hook.result.current.phase).toBe('idle');
    expect(hook.result.current.message).toBeUndefined();

    mocked.sessionId = 'a';
    mocked.currentModelKey = a2;
    hook.rerender();
    expect(hook.result.current.activeValue).toBe(encodeModelKey(a2));
    expect(hook.result.current.activeLabel).toContain('A Two');
    expect(hook.result.current.phase).toBe('succeeded');
    expect(hook.result.current.message).toContain('A Two');
  });

  it('uses the selected session reasoning projection for each addressed switch', async () => {
    const requests: Array<{ sessionId: string | null; reasoningEffort?: string }> = [];
    mocked.sessionId = 'a';
    mocked.currentModelKey = a1;
    mocked.currentReasoningEffort = 'low';
    mocked.chatService = {
      get activeSessionId() { return mocked.sessionId; },
      runtimeSettings: {
        getModelSwitchBlockedReason: () => null,
        switchModel: vi.fn(async (request, _host, publish) => {
          requests.push(request);
          publish('succeeded', request);
          mocked.currentModelKey = request.to;
          return {
            kind: 'succeeded', requestId: request.requestId,
            active: request.to, persisted: request.to,
          };
        }),
        retryModelDefaultPersistence: vi.fn(),
      },
    };
    const registry = new LiveModelRegistry([
      {
        id: 'provider-a', name: 'Provider A', type: 'openai',
        models: [{ id: 'a-1', name: 'A One' }, { id: 'a-2', name: 'A Two' }],
      },
      {
        id: 'provider-b', name: 'Provider B', type: 'anthropic',
        models: [{ id: 'b-1', name: 'B One' }, { id: 'b-2', name: 'B Two' }],
      },
    ]);
    const host = {
      getPersisted: () => a1,
      prepareConfig: vi.fn(),
      persistDefault: vi.fn(),
    } as unknown as ModelSwitchHost;
    const hook = renderHook(() => useAgentShellModelControl(registry, host, a1));
    mocked.sessionId = 'b';
    mocked.currentModelKey = b1;
    mocked.currentReasoningEffort = 'high';
    hook.rerender();
    await act(async () => { await hook.result.current.modelSelection.select(encodeModelKey(b2)); });
    expect(requests.at(-1)).toMatchObject({ sessionId: 'b', reasoningEffort: 'high' });

    mocked.sessionId = 'a';
    mocked.currentModelKey = a1;
    mocked.currentReasoningEffort = 'low';
    hook.rerender();
    await act(async () => { await hook.result.current.modelSelection.select(encodeModelKey(a2)); });
    expect(requests.at(-1)).toMatchObject({ sessionId: 'a', reasoningEffort: 'low' });

  });
});
