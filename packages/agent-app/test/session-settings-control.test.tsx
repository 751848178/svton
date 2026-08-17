import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionProfileHost } from '@svton/agent-client';
import { LocaleProvider } from '@svton/ui';
import type { ReactNode } from 'react';

const zhWrapper = ({ children }: { children: ReactNode }) => (
  <LocaleProvider locale="zh">{children}</LocaleProvider>
);

const mocked = vi.hoisted(() => ({
  sessionId: 'session-a' as string | null,
  currentModelKey: { providerId: 'provider', modelId: 'reasoning-model' } as {
    providerId: string; modelId: string;
  } | null,
  currentPermissionMode: 'default' as 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto' | undefined,
  currentReasoningEffort: undefined as 'low' | 'medium' | 'high' | 'xhigh' | undefined,
  runtimeSettings: {
    getPermissionProfileBlockedReason: vi.fn(() => null as string | null),
    switchPermissionProfile: vi.fn(),
    setReasoningEffort: vi.fn(),
  },
}));

vi.mock('@svton/agent-client', async () => {
  const actual = await vi.importActual<typeof import('@svton/agent-client')>('@svton/agent-client');
  return {
    ...actual,
    useAgentContext: () => ({
      chatService: {
        get activeSessionId() { return mocked.sessionId; },
        runtimeSettings: mocked.runtimeSettings,
      },
    }),
    useChat: () => ({
      currentModelKey: mocked.currentModelKey,
      currentPermissionMode: mocked.currentPermissionMode,
      currentReasoningEffort: mocked.currentReasoningEffort,
    }),
  };
});

import { LiveModelRegistry } from '../src/models/model-registry';
import { useSessionSettingsControl } from '../src/models/use-session-settings-control';

describe('useSessionSettingsControl', () => {
  it('projects only active-model capabilities and identifies its default without selecting it', () => {
    const registry = registryWithReasoning();
    const hook = renderHook(() => useSessionSettingsControl(registry, host()), {
      wrapper: zhWrapper,
    });

    expect(hook.result.current.reasoning).toMatchObject({
      value: undefined,
      availableEfforts: ['low', 'high'],
      defaultEffort: 'high',
    });

    mocked.currentModelKey = { providerId: 'removed', modelId: 'unknown' };
    mocked.currentReasoningEffort = 'medium';
    hook.rerender();
    expect(hook.result.current.reasoning).toMatchObject({
      value: 'medium', availableEfforts: [], defaultEffort: undefined,
    });
  });

  it('addresses permission and reasoning mutations to the active session', async () => {
    mocked.currentModelKey = { providerId: 'provider', modelId: 'reasoning-model' };
    mocked.currentPermissionMode = 'default';
    mocked.currentReasoningEffort = undefined;
    mocked.runtimeSettings.switchPermissionProfile.mockImplementation(
      async (request, _host, publish) => {
        publish('applying', request);
        return { kind: 'succeeded', requestId: request.requestId, active: request.to, persisted: request.to };
      },
    );
    mocked.runtimeSettings.setReasoningEffort.mockResolvedValue({ kind: 'succeeded' });
    const permissionHost = host();
    const hook = renderHook(() => useSessionSettingsControl(registryWithReasoning(), permissionHost), {
      wrapper: zhWrapper,
    });

    await act(async () => { await hook.result.current.execution.select('accept_edits'); });
    expect(mocked.runtimeSettings.switchPermissionProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-a', from: 'default', to: 'accept_edits',
      }),
      permissionHost,
      expect.any(Function),
    );
    await act(async () => { await hook.result.current.reasoning.select('high'); });
    expect(mocked.runtimeSettings.setReasoningEffort).toHaveBeenCalledWith('high');
  });

  it('rejects unsupported reasoning values without calling the runtime setter', async () => {
    mocked.currentReasoningEffort = undefined;
    mocked.runtimeSettings.setReasoningEffort.mockClear();
    const hook = renderHook(() => useSessionSettingsControl(registryWithReasoning(), host()), {
      wrapper: zhWrapper,
    });

    await act(async () => {
      await hook.result.current.reasoning.select('medium');
    });

    expect(mocked.runtimeSettings.setReasoningEffort).not.toHaveBeenCalled();
    expect(hook.result.current.reasoning).toMatchObject({
      phase: 'failed', message: '当前模型不支持推理强度设置。',
    });
  });

  it.each([
    [{
      kind: 'failed', requestId: 'failed', code: 'persistence', message: '保存失败。',
      active: 'default', persisted: 'default', rolledBack: true, activeDefaultSplit: false,
    }, '当前会话已回滚到默认'],
    [{
      kind: 'failed', requestId: 'failed', code: 'persistence', message: '保存失败。',
      active: 'auto', persisted: 'default', rolledBack: false, activeDefaultSplit: true,
    }, '当前会话为全自动，未来会话默认为默认'],
  ] as const)('reports honest rollback/split outcome %#', async (result, message) => {
    mocked.currentPermissionMode = 'default';
    mocked.runtimeSettings.switchPermissionProfile.mockResolvedValue(result);
    const hook = renderHook(() => useSessionSettingsControl(registryWithReasoning(), host()), {
      wrapper: zhWrapper,
    });

    await act(async () => { await hook.result.current.execution.select('auto'); });

    expect(hook.result.current.execution.message).toContain(message);
  });
});

function registryWithReasoning() {
  return new LiveModelRegistry([{
    id: 'provider', name: 'Provider', type: 'openai',
    models: [{
      id: 'reasoning-model', name: 'Reasoning Model',
      reasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high',
    }],
  }]);
}

function host(): PermissionProfileHost {
  return { getPersisted: () => 'default', persistDefault: vi.fn(async () => {}) };
}
