/**
 * PI006 — SubagentManager isolatedContext through the Pi-backed runtime.
 *
 * Replaces the stale mock that referenced the deleted `IProvider`. This now
 * drives a REAL `SvtonAgentRuntime` child (Pi Agent under the hood) via
 * `createMockModels()`, proving:
 *   - non-isolated context seeds parent messages into the child's Pi state
 *     (`setMessages` → `agent.state.messages`)
 *   - isolated context (the default) does NOT inherit parent messages
 *
 * The subagent runtime reads its post-run transcript from Pi Agent state via
 * `getMessages()` from canonical Pi state, so seeding is observable end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig, IRuntime } from '../src/agent/types';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { UserMessage } from '@earendil-works/pi-ai';
import { createMockModels, createMockPlatform, fauxAssistantMessage, fauxText } from './helpers';

function createPlatform() {
  return createMockPlatform({ capabilities: { filesystem: false, process: false } });
}

/** Build a parent AgentConfig backed by the faux pi-ai Models collection. */
function createConfig(toolRegistry: ToolRegistry): { config: AgentConfig; mock: ReturnType<typeof createMockModels> } {
  const mock = createMockModels();
  // Child runtime will consume this response when it runs the task.
  mock.addResponse(fauxAssistantMessage([fauxText('Subagent done.')]));
  const config: AgentConfig = {
    models: mock.models,
    piModel: mock.model,
    model: 'test-model',
    toolRegistry,
  };
  return { config, mock };
}

describe('SubagentManager isolatedContext (Pi-backed SvtonAgentRuntime child)', () => {
  it('seeds parent messages into the child Pi state when isolatedContext is false', async () => {
    const parentUser: UserMessage = {
      role: 'user',
      content: 'Parent question',
      timestamp: 1,
    };
    const parentMessages: AgentMessage[] = [
      parentUser,
      fauxAssistantMessage([fauxText('Parent answer')]),
    ];
    const toolRegistry = new ToolRegistry();
    const { config } = createConfig(toolRegistry);

    // Parent runtime exposes the seed transcript via getMessages().
    const parentRuntime: IRuntime = {
      run: async function* () { yield { type: 'done', stopReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }; },
      getMessages: () => parentMessages,
      reset: () => {},
      abort: () => {},
    };

    const manager = new SubagentManager(config, parentRuntime, createPlatform(), toolRegistry);

    const result = await manager.spawn({ task: 'Use parent context', isolatedContext: false });

    expect(result.success).toBe(true);
    // The child ran through the real SvtonAgentRuntime. Non-isolated context
    // means the parent's 2 seed messages precede the task; after the run the
    // transcript holds at least the seed + the new exchange.
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.messages.some((m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('Parent question'))).toBe(true);
  });

  it('does NOT inherit parent messages when isolatedContext is true (default)', async () => {
    const parentUser: UserMessage = {
      role: 'user',
      content: 'Parent-only secret',
      timestamp: 1,
    };
    const parentMessages: AgentMessage[] = [
      parentUser,
      fauxAssistantMessage([fauxText('Parent-only answer')]),
    ];
    const toolRegistry = new ToolRegistry();
    const { config } = createConfig(toolRegistry);

    const parentRuntime: IRuntime = {
      run: async function* () { yield { type: 'done', stopReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }; },
      getMessages: () => parentMessages,
      reset: () => {},
      abort: () => {},
    };

    const manager = new SubagentManager(config, parentRuntime, createPlatform(), toolRegistry);

    const result = await manager.spawn({ task: 'Stay isolated' });

    expect(result.success).toBe(true);
    // Isolated: the parent's "Parent-only secret" must never appear in the
    // child transcript.
    expect(result.messages.some((m) => typeof m.content === 'string' && m.content.includes('Parent-only secret'))).toBe(false);
  });
});
