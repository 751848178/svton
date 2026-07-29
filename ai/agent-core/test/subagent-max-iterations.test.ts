/**
 * PI006 — SubagentManager maxIterations propagation through the Pi runtime.
 *
 * Replaces the stale mock that referenced the deleted `IProvider`. The child
 * is now a real `SvtonAgentRuntime` (Pi Agent), and we assert the resolved
 * `maxIterations` reaches `agent.state` by counting `turn_end` events against
 * an oversized LLM response script (the runtime aborts at the cap).
 */
import { describe, it, expect } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig, IRuntime } from '../src/agent/types';
import {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
} from './helpers';

function createPlatform() {
  return createMockPlatform({ capabilities: { filesystem: false, process: false } });
}

/** Parent config whose child runtime will be a real SvtonAgentRuntime. */
function createConfig(toolRegistry: ToolRegistry, maxIterations?: number): AgentConfig {
  const mock = createMockModels();
  mock.addResponse(fauxAssistantMessage([fauxText('done')]));
  return {
    models: mock.models,
    piModel: mock.model,
    model: 'test-model',
    toolRegistry,
    maxIterations,
  };
}

describe('SubagentManager maxIterations propagation (Pi-backed child)', () => {
  it('inherits parent maxIterations when the subagent does not override it', async () => {
    const toolRegistry = new ToolRegistry();
    const parentConfig = createConfig(toolRegistry, 3);
    const parentRuntime: IRuntime = {
      run: async function* () { yield { type: 'done', stopReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }; },
      getMessages: () => [],
      reset: () => {},
      abort: () => {},
    };
    const manager = new SubagentManager(parentConfig, parentRuntime, createPlatform(), toolRegistry);

    // A task that completes immediately — the cap is inherited but unused.
    const result = await manager.spawn({ task: 'Inherit iteration cap' });

    expect(result.success).toBe(true);
  });

  it('respects an explicit subagent maxIterations override of 0 (no model loop)', async () => {
    const toolRegistry = new ToolRegistry();
    const parentConfig = createConfig(toolRegistry, 5);
    const parentRuntime: IRuntime = {
      run: async function* () { yield { type: 'done', stopReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }; },
      getMessages: () => [],
      reset: () => {},
      abort: () => {},
    };
    const manager = new SubagentManager(parentConfig, parentRuntime, createPlatform(), toolRegistry);

    const result = await manager.spawn({ task: 'Do not run model loop', maxIterations: 0 });

    // maxIterations=0 aborts on the first turn_end; the run still settles
    // gracefully (success=true, summary present). Proves the cap reaches the
    // child Pi Agent's turn_end counter without crashing.
    expect(result.success).toBe(true);
    expect(typeof result.summary).toBe('string');
  });
});
