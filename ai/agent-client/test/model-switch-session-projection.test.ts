import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig, SvtonAgentRuntime } from '@svton/agent-core';
import { ChatService } from '../src/service/chat.service';
import type { ChatRuntimeSlot } from '../src/service/chat-runtime-registry.types';

function runtime(): SvtonAgentRuntime {
  return {
    abort: vi.fn(),
    reset: vi.fn(),
    getMessages: vi.fn(() => []),
  } as unknown as SvtonAgentRuntime;
}

function slot(
  sessionId: string,
  providerId: string | null,
  model: string,
  reasoningEffort: AgentConfig['reasoningEffort'],
): ChatRuntimeSlot {
  return {
    sessionId,
    runtime: runtime(),
    configRevision: 1,
    model,
    modelKey: providerId ? { providerId, modelId: model } : null,
    reasoningEffort,
    sessionScoped: true,
  };
}

describe('session model projection', () => {
  it('projects distinct model and reasoning identities while navigating A and B', () => {
    const service = new ChatService();
    const registry = Reflect.get(service, 'runtimeRegistry') as object;
    const slots = Reflect.get(registry, 'slots') as Map<string, ChatRuntimeSlot>;
    slots.set('a', slot('a', 'provider-a', 'shared', 'low'));
    slots.set('b', slot('b', 'provider-b', 'shared', 'high'));
    service.bindSession('a');
    expect(service.currentModelKey).toEqual({ providerId: 'provider-a', modelId: 'shared' });
    expect(service.currentReasoningEffort).toBe('low');
    service.bindSession('b');
    expect(service.currentModelKey).toEqual({ providerId: 'provider-b', modelId: 'shared' });
    expect(service.currentReasoningEffort).toBe('high');
  });

  it('never carries B identity or reasoning into a legacy null-key slot', () => {
    const service = new ChatService();
    const registry = Reflect.get(service, 'runtimeRegistry') as object;
    const slots = Reflect.get(registry, 'slots') as Map<string, ChatRuntimeSlot>;
    slots.set('b', slot('b', 'provider-b', 'shared', 'high'));
    slots.set('legacy', slot('legacy', null, 'legacy-model', undefined));
    service.bindSession('b');
    service.bindSession('legacy');
    expect(service.currentModel).toBe('legacy-model');
    expect(service.currentModelKey).toBeNull();
    expect(service.currentReasoningEffort).toBeUndefined();
  });
});
