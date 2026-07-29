/**
 * Streamed-turn integration test (PI008) — proves the agent-web wiring
 * (AgentConfig shape from initAgentConfig → ChatService → Pi-backed runtime)
 * projects a native Pi streamed turn and awaited settlement through the live
 * SvtonAgentRuntime.
 *
 * Deterministic: the pi-ai Models collection is backed by `fauxProvider`
 * (re-used from agent-core's shared test helpers), so no network and no real
 * API key. The config mirrors the shape initAgentConfig returns (models +
 * piModel + model + toolRegistry + workingDir), validating that the web
 * consumer's wiring is migration-compatible.
 *
 * This is the agent-web analogue of agent-client/test/chat.service.test.ts:
 * it drives a real runtime.run stream rather than an EventScripter mock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { ChatService } from '@svton/agent-client';
import { ToolRegistry } from '@svton/agent-core';
import type { AgentConfig } from '@svton/agent-core';
import {
  createMockModels,
  createMockPlatform,
  MemoryStorage,
  fauxAssistantMessage,
  fauxText,
} from '../../../ai/agent-core/test/helpers';

/** Build an AgentConfig with the same field shape initAgentConfig returns. */
function buildConfig(): { config: AgentConfig } {
  const mock = createMockModels('gpt-4o');
  const config: AgentConfig = {
    models: mock.models,
    piModel: mock.model,
    model: 'gpt-4o',
    toolRegistry: new ToolRegistry(),
    workingDir: '/',
  };
  // Queue a single assistant turn: "Hello from web".
  mock.addResponse(fauxAssistantMessage([fauxText('Hello from web')]));
  return { config };
}

describe('agent-web streamed turn (ChatService → Pi runtime)', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
  });

  it('produces text content and settles to idle after native agent_end', async () => {
    const { config } = buildConfig();
    const platform = createMockPlatform({ storage: new MemoryStorage(), type: 'browser' });
    await service.init(platform, config);

    expect(service.status).toBe('idle');
    await service.sendMessage('Hi');

    // One user + one assistant message after the turn.
    expect(service.messages.length).toBe(2);
    const assistant = service.messages.find((m) => m.role === 'assistant')!;
    expect(assistant).toBeDefined();
    expect(assistant.content).toContain('Hello from web');
    // Turn settles back to idle after the native generator completes.
    expect(service.status).toBe('idle');
  });

  it('initAgentConfig-shaped config (models + piModel) drives the runtime', async () => {
    const { config } = buildConfig();
    // The two Pi-specific fields the migration added (PI003): a pi-ai Models
    // collection + a resolved piModel. ChatService.init consumes both.
    expect(config.models).toBeDefined();
    expect(config.piModel).toBeDefined();
    expect((config.piModel as any).id).toBe('gpt-4o');

    const platform = createMockPlatform({ storage: new MemoryStorage(), type: 'browser' });
    await service.init(platform, config);
    expect(service.currentModel).toBe('gpt-4o');
  });
});
