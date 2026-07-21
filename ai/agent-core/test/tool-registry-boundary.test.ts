import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '../src/provider/types';
import { ToolRegistry } from '../src/tool/registry';
import type { IToolExecutor } from '../src/tool/types';

const executor: IToolExecutor = {
  execute: async (call) => ({ callId: call.id, output: 'ok' }),
};

function makeDefinition(): ToolDefinition {
  return {
    name: 'owned_tool',
    description: 'Original description',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
      },
      required: ['command'],
    },
    annotations: {
      readOnlyHint: true,
    },
  };
}

describe('ToolRegistry definition ownership boundaries', () => {
  it('stores and returns definition copies without mutating executors', () => {
    const registry = new ToolRegistry();
    const definition = makeDefinition();

    registry.register(definition, executor);
    definition.description = 'Injected from caller';
    definition.parameters.properties.command = { type: 'number' };
    definition.annotations!.readOnlyHint = false;

    const firstEntry = registry.get('owned_tool');
    expect(firstEntry?.executor).toBe(executor);
    expect(firstEntry?.definition.description).toBe('Original description');
    expect(firstEntry?.definition.parameters.properties.command).toMatchObject({
      type: 'string',
      description: 'Command to run',
    });
    expect(firstEntry?.definition.annotations?.readOnlyHint).toBe(true);

    firstEntry!.definition.description = 'Injected from get';
    firstEntry!.definition.parameters.properties.command = { type: 'boolean' };

    const listed = registry.listDefinitions();
    listed[0].description = 'Injected from list';
    listed[0].parameters.properties.command = { type: 'array' };

    const freshEntry = registry.get('owned_tool');
    expect(freshEntry?.definition.description).toBe('Original description');
    expect(freshEntry?.definition.parameters.properties.command).toMatchObject({
      type: 'string',
      description: 'Command to run',
    });
  });
});
