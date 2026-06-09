import { describe, it, expect, vi } from 'vitest';
import type {
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
  ToolEntry,
} from '@svton/agent-core';
import {
  ToolRegistry,
  fileReadDef,
  fileWriteDef,
  fileEditDef,
  grepDef,
  globDef,
  bashDef,
  webSearchDef,
  webFetchDef,
} from '@svton/agent-core';

// ============================================================
// Helpers
// ============================================================

const mockPlatform = {
  type: 'browser' as const,
  capabilities: {
    filesystem: false,
    process: false,
    watch: false,
    mcpStdio: false,
    clipboard: false,
    notification: false,
  },
  fs: {} as any,
  process: {} as any,
  storage: {} as any,
  search: {} as any,
};

const mockContext: ToolContext = {
  platform: mockPlatform,
  sessionId: 'test-session',
  workingDir: '/test',
};

/** Create a simple tool definition */
function makeToolDef(name: string, overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    name,
    description: `Description for ${name}`,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input value' },
      },
      required: ['input'],
    },
    ...overrides,
  };
}

/** Create a mock executor */
function makeExecutor(result?: Partial<ToolResult>): IToolExecutor {
  return {
    execute: vi.fn(async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      return {
        callId: call.id,
        output: `Executed ${call.name}`,
        ...result,
      };
    }),
  };
}

/** Create a tool call */
function makeToolCall(name: string, args?: Record<string, unknown>): ToolCall {
  return {
    id: `call_${name}_1`,
    name,
    arguments: args ?? { input: 'test' },
  };
}

// ============================================================
// ToolRegistry
// ============================================================

describe('ToolRegistry', () => {
  describe('register', () => {
    it('registers a tool and makes it available', () => {
      const registry = new ToolRegistry();
      const def = makeToolDef('my_tool');
      const executor = makeExecutor();

      registry.register(def, executor);

      expect(registry.has('my_tool')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('allows registering multiple tools', () => {
      const registry = new ToolRegistry();

      registry.register(makeToolDef('tool_a'), makeExecutor());
      registry.register(makeToolDef('tool_b'), makeExecutor());
      registry.register(makeToolDef('tool_c'), makeExecutor());

      expect(registry.size).toBe(3);
      expect(registry.has('tool_a')).toBe(true);
      expect(registry.has('tool_b')).toBe(true);
      expect(registry.has('tool_c')).toBe(true);
    });

    it('overwrites when registering a tool with the same name', () => {
      const registry = new ToolRegistry();
      const executor1 = makeExecutor();
      const executor2 = makeExecutor();

      registry.register(makeToolDef('my_tool'), executor1);
      registry.register(makeToolDef('my_tool', { description: 'Updated' }), executor2);

      expect(registry.size).toBe(1);
      const entry = registry.get('my_tool');
      expect(entry?.definition.description).toBe('Updated');
    });
  });

  describe('unregister', () => {
    it('removes a registered tool and returns true', () => {
      const registry = new ToolRegistry();
      registry.register(makeToolDef('my_tool'), makeExecutor());

      const result = registry.unregister('my_tool');

      expect(result).toBe(true);
      expect(registry.has('my_tool')).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('returns false when unregistering a non-existent tool', () => {
      const registry = new ToolRegistry();

      const result = registry.unregister('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('returns ToolEntry for a registered tool', () => {
      const registry = new ToolRegistry();
      const def = makeToolDef('my_tool');
      const executor = makeExecutor();
      registry.register(def, executor);

      const entry = registry.get('my_tool');

      expect(entry).not.toBeNull();
      expect(entry!.definition).toBe(def);
      expect(entry!.executor).toBe(executor);
    });

    it('returns null for a non-existent tool', () => {
      const registry = new ToolRegistry();

      const entry = registry.get('nonexistent');

      expect(entry).toBeNull();
    });
  });

  describe('listDefinitions', () => {
    it('returns empty array when no tools registered', () => {
      const registry = new ToolRegistry();

      const defs = registry.listDefinitions();

      expect(defs).toEqual([]);
    });

    it('returns all registered tool definitions', () => {
      const registry = new ToolRegistry();
      const defA = makeToolDef('tool_a');
      const defB = makeToolDef('tool_b');
      registry.register(defA, makeExecutor());
      registry.register(defB, makeExecutor());

      const defs = registry.listDefinitions();

      expect(defs).toHaveLength(2);
      const names = defs.map((d) => d.name);
      expect(names).toContain('tool_a');
      expect(names).toContain('tool_b');
    });
  });

  describe('has', () => {
    it('returns true for a registered tool', () => {
      const registry = new ToolRegistry();
      registry.register(makeToolDef('my_tool'), makeExecutor());

      expect(registry.has('my_tool')).toBe(true);
    });

    it('returns false for a non-existent tool', () => {
      const registry = new ToolRegistry();

      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('execute', () => {
    it('executes a registered tool and returns its result', async () => {
      const registry = new ToolRegistry();
      const executor = makeExecutor();
      registry.register(makeToolDef('my_tool'), executor);

      const call = makeToolCall('my_tool');
      const result = await registry.execute(call, mockContext);

      expect(result.callId).toBe('call_my_tool_1');
      expect(result.output).toBe('Executed my_tool');
      expect(result.isError).toBeUndefined();
      expect(executor.execute).toHaveBeenCalledWith(call, mockContext);
    });

    it('returns error result for an unknown tool', async () => {
      const registry = new ToolRegistry();

      const call = makeToolCall('unknown_tool');
      const result = await registry.execute(call, mockContext);

      expect(result.callId).toBe('call_unknown_tool_1');
      expect(result.output).toBe('Unknown tool: unknown_tool');
      expect(result.isError).toBe(true);
    });

    it('catches executor errors and returns them as ToolResult', async () => {
      const registry = new ToolRegistry();
      const failingExecutor: IToolExecutor = {
        execute: vi.fn(async () => {
          throw new Error('Something went wrong');
        }),
      };
      registry.register(makeToolDef('failing_tool'), failingExecutor);

      const call = makeToolCall('failing_tool');
      const result = await registry.execute(call, mockContext);

      expect(result.callId).toBe('call_failing_tool_1');
      expect(result.output).toBe('Something went wrong');
      expect(result.isError).toBe(true);
    });

    it('handles non-Error throws in executor', async () => {
      const registry = new ToolRegistry();
      const stringThrowExecutor: IToolExecutor = {
        execute: vi.fn(async () => {
          throw 'string error'; // eslint-disable-line no-throw-literal
        }),
      };
      registry.register(makeToolDef('string_throw'), stringThrowExecutor);

      const call = makeToolCall('string_throw');
      const result = await registry.execute(call, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toBe('string error');
    });

    it('passes arguments through to executor', async () => {
      const registry = new ToolRegistry();
      const executor = makeExecutor();
      registry.register(makeToolDef('my_tool'), executor);

      const call: ToolCall = {
        id: 'call_1',
        name: 'my_tool',
        arguments: { path: '/some/file.txt', mode: 'read' },
      };

      await registry.execute(call, mockContext);

      expect(executor.execute).toHaveBeenCalledWith(call, mockContext);
      // Verify the call object passed had the right arguments
      const [passedCall] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(passedCall.arguments).toEqual({ path: '/some/file.txt', mode: 'read' });
    });

    it('passes signal in context to executor', async () => {
      const registry = new ToolRegistry();
      const executor = makeExecutor();
      registry.register(makeToolDef('my_tool'), executor);

      const controller = new AbortController();
      const ctxWithSignal: ToolContext = {
        ...mockContext,
        signal: controller.signal,
      };

      const call = makeToolCall('my_tool');
      await registry.execute(call, ctxWithSignal);

      expect(executor.execute).toHaveBeenCalledWith(call, ctxWithSignal);
    });
  });

  describe('size', () => {
    it('returns 0 for empty registry', () => {
      const registry = new ToolRegistry();
      expect(registry.size).toBe(0);
    });

    it('returns correct count after register/unregister', () => {
      const registry = new ToolRegistry();

      registry.register(makeToolDef('a'), makeExecutor());
      expect(registry.size).toBe(1);

      registry.register(makeToolDef('b'), makeExecutor());
      expect(registry.size).toBe(2);

      registry.unregister('a');
      expect(registry.size).toBe(1);

      registry.unregister('b');
      expect(registry.size).toBe(0);
    });
  });
});

// ============================================================
// Built-in Tool Definitions
// ============================================================

describe('Built-in tool definitions', () => {
  function assertValidToolDef(def: ToolDefinition, expectedName: string) {
    expect(def.name).toBe(expectedName);
    expect(typeof def.description).toBe('string');
    expect(def.description.length).toBeGreaterThan(0);
    expect(def.parameters.type).toBe('object');
    expect(typeof def.parameters.properties).toBe('object');
  }

  // ----------------------------------------------------------
  // File tools
  // ----------------------------------------------------------

  describe('file tools', () => {
    it('fileReadDef has correct structure', () => {
      assertValidToolDef(fileReadDef, 'file_read');
      expect(fileReadDef.parameters.required).toContain('path');
      expect(fileReadDef.parameters.properties).toHaveProperty('path');
      expect(fileReadDef.parameters.properties).toHaveProperty('offset');
      expect(fileReadDef.parameters.properties).toHaveProperty('limit');
      expect(fileReadDef.annotations?.readOnlyHint).toBe(true);
      expect(fileReadDef.annotations?.destructiveHint).toBe(false);
    });

    it('fileWriteDef has correct structure', () => {
      assertValidToolDef(fileWriteDef, 'file_write');
      expect(fileWriteDef.parameters.required).toEqual(['path', 'content']);
      expect(fileWriteDef.parameters.properties).toHaveProperty('path');
      expect(fileWriteDef.parameters.properties).toHaveProperty('content');
      expect(fileWriteDef.annotations?.readOnlyHint).toBe(false);
      expect(fileWriteDef.annotations?.destructiveHint).toBe(true);
    });

    it('fileEditDef has correct structure', () => {
      assertValidToolDef(fileEditDef, 'file_edit');
      expect(fileEditDef.parameters.required).toEqual(['path', 'old_string', 'new_string']);
      expect(fileEditDef.parameters.properties).toHaveProperty('path');
      expect(fileEditDef.parameters.properties).toHaveProperty('old_string');
      expect(fileEditDef.parameters.properties).toHaveProperty('new_string');
      expect(fileEditDef.parameters.properties).toHaveProperty('replace_all');
      expect(fileEditDef.annotations?.destructiveHint).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Search tools
  // ----------------------------------------------------------

  describe('search tools', () => {
    it('grepDef has correct structure', () => {
      assertValidToolDef(grepDef, 'grep');
      expect(grepDef.parameters.required).toContain('pattern');
      expect(grepDef.parameters.required).toContain('path');
      expect(grepDef.parameters.properties).toHaveProperty('pattern');
      expect(grepDef.parameters.properties).toHaveProperty('path');
      expect(grepDef.parameters.properties).toHaveProperty('include');
      expect(grepDef.parameters.properties).toHaveProperty('ignore_case');
      expect(grepDef.parameters.properties).toHaveProperty('max_results');
      expect(grepDef.annotations?.readOnlyHint).toBe(true);
      expect(grepDef.annotations?.destructiveHint).toBe(false);
    });

    it('globDef has correct structure', () => {
      assertValidToolDef(globDef, 'glob');
      expect(globDef.parameters.required).toContain('pattern');
      expect(globDef.parameters.properties).toHaveProperty('pattern');
      expect(globDef.parameters.properties).toHaveProperty('path');
      expect(globDef.annotations?.readOnlyHint).toBe(true);
      expect(globDef.annotations?.destructiveHint).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // Shell tools
  // ----------------------------------------------------------

  describe('shell tools', () => {
    it('bashDef has correct structure', () => {
      assertValidToolDef(bashDef, 'bash');
      expect(bashDef.parameters.required).toContain('command');
      expect(bashDef.parameters.properties).toHaveProperty('command');
      expect(bashDef.parameters.properties).toHaveProperty('timeout');
      expect(bashDef.annotations?.destructiveHint).toBe(true);
      expect(bashDef.annotations?.openWorldHint).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Web tools
  // ----------------------------------------------------------

  describe('web tools', () => {
    it('webSearchDef has correct structure', () => {
      assertValidToolDef(webSearchDef, 'web_search');
      expect(webSearchDef.parameters.required).toContain('query');
      expect(webSearchDef.parameters.properties).toHaveProperty('query');
      expect(webSearchDef.parameters.properties).toHaveProperty('max_results');
      expect(webSearchDef.annotations?.readOnlyHint).toBe(true);
      expect(webSearchDef.annotations?.openWorldHint).toBe(true);
    });

    it('webFetchDef has correct structure', () => {
      assertValidToolDef(webFetchDef, 'web_fetch');
      expect(webFetchDef.parameters.required).toContain('url');
      expect(webFetchDef.parameters.properties).toHaveProperty('url');
      expect(webFetchDef.parameters.properties).toHaveProperty('format');
      expect(webFetchDef.annotations?.readOnlyHint).toBe(true);
      expect(webFetchDef.annotations?.openWorldHint).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // All definitions are distinct
  // ----------------------------------------------------------

  it('all built-in tool names are unique', () => {
    const allDefs = [fileReadDef, fileWriteDef, fileEditDef, grepDef, globDef, bashDef, webSearchDef, webFetchDef];
    const names = allDefs.map((d) => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
