import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '../src/provider/types';
import { ToolRegistry } from '../src/tool/registry';
import type { IToolExecutor, ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

const throwingToolDef: ToolDefinition = {
  name: 'throwing_tool',
  description: 'Throws a non-Error value.',
  parameters: { type: 'object', properties: {} },
};

function makeCall(): ToolCall {
  return { id: 'throwing-call', name: 'throwing_tool', arguments: {} };
}

function makeContext(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 'session',
    workingDir: '/repo',
  };
}

describe('ToolRegistry error formatting', () => {
  it('normalizes non-Error executor throws', async () => {
    const executor: IToolExecutor = {
      execute: async () => {
        throw { code: 'tool_down' };
      },
    };
    const registry = new ToolRegistry();
    registry.register(throwingToolDef, executor);

    const result = await registry.execute(makeCall(), makeContext());

    expect(result.callId).toBe('throwing-call');
    expect(result.isError).toBe(true);
    expect(result.output).toBe('Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });
});
