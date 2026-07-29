/**
 * PI006 — MCP capability bridge through the Pi-backed runtime.
 *
 * Proves two PI006 concerns end-to-end through the `AgentTool` bridge:
 *
 * 1. **MCP schema robustness**: a representative complex MCP input schema
 *    ($ref + $defs + oneOf + anyOf + array items) flows through
 *    `normalizeParameters` and pi-ai's `validateToolArguments` ACCEPTS valid
 *    args and REJECTS invalid ones. (PI005 flagged shallow normalization as a
 *    risk for PI006; this verifies pi-ai's validator is JSON-Schema-aware and
 *    the current normalization is sufficient.)
 *
 * 2. **MCP no-bypass**: an MCP-bridged tool (registered through
 *    `bridgeMcpTools` → ToolRegistry → `buildAgentTools`) is denied by the
 *    permission gate without executing the MCP executor, and executes when
 *    allowed. MCP tools flow through the SAME `ToolExecutionService` pipeline
 *    as builtins. (Subagent no-bypass is covered in pi006-subagent-pipeline.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, PermissionManager } from '@svton/agent-core';
import { ToolExecutionService } from '../src/agent/tool-executor';
import { buildAgentTools, type ToolEventSink } from '../src/agent/pi-tool-adapter';
import { validateToolArguments } from '@earendil-works/pi-ai';
import type { SvtonToolDefinition, SvtonToolAnnotations } from '@svton/agent-core';
import type {
  ToolCall,
  ToolResult,
  IToolExecutor,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ============================================================
// Mocks
// ============================================================

function createMockPlatform(): IPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true, process: true, watch: false, mcpStdio: false,
      clipboard: false, notification: false, sandboxing: false, pty: false,
      documentPreview: false, computerUse: false,
    },
    fs: {} as any, process: {} as any, storage: {} as any, search: {} as any,
  };
}

function recordingExecutor(): IToolExecutor & { calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    async execute(call: ToolCall): Promise<ToolResult> {
      calls.push(call);
      return { callId: call.id, output: 'mcp-ran' };
    },
  };
}

function call(name: string): ToolCall {
  return { id: `call-${name}-${Math.random().toString(36).slice(2, 6)}`, name, arguments: {} };
}

/** A representative complex MCP input schema ($ref + $defs + oneOf + anyOf). */
function complexMcpParameters(): SvtonToolDefinition['parameters'] {
  return {
    type: 'object',
    properties: {
      query: { type: 'string' },
      filter: { $ref: '#/$defs/Filter' },
      mode: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      kind: { oneOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }] },
      tags: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
    },
    required: ['query'],
    $defs: {
      Filter: {
        type: 'object',
        properties: { field: { type: 'string' }, nested: { $ref: '#/$defs/Inner' } },
      },
      Inner: { type: 'string', enum: ['x', 'y'] },
    },
  } as SvtonToolDefinition['parameters'];
}

const sink: ToolEventSink = () => {};

// ============================================================
// 1. MCP schema robustness through pi-ai's validator
// ============================================================

describe('PI006 MCP schema robustness (complex shapes through pi-ai validator)', () => {
  let registry: ToolRegistry;
  let service: ToolExecutionService;

  beforeEach(() => {
    registry = new ToolRegistry();
    service = new ToolExecutionService(
      registry, createMockPlatform(), '/project',
      new PermissionManager({ mode: 'auto' }), null, new Map(),
    );
  });

  it('passes a complex MCP schema through normalizeParameters unchanged in shape', () => {
    const def: SvtonToolDefinition = {
      name: 'mcp__srv__search',
      description: 'complex',
      parameters: complexMcpParameters(),
      annotations: { openWorldHint: true } as SvtonToolAnnotations,
    };
    registry.register(def, recordingExecutor());
    const tool = buildAgentTools(registry, service, sink)[0];
    const params = tool.parameters as unknown as Record<string, unknown>;
    // The svton-only `annotations` are stripped; the JSON-schema body (incl.
    // $ref/$defs/oneOf/anyOf) is preserved verbatim for pi-ai's validator.
    expect(params.annotations).toBeUndefined();
    expect(params.type).toBe('object');
    expect(params.$defs).toBeDefined();
    expect((params.properties as Record<string, unknown>).filter).toBeDefined();
  });

  it('accepts valid args against a complex MCP schema via validateToolArguments', () => {
    const def: SvtonToolDefinition = { name: 'search', description: 'd', parameters: complexMcpParameters() };
    registry.register(def, recordingExecutor());
    const tool = buildAgentTools(registry, service, sink)[0];
    const valid = { query: 'hi', filter: { field: 'x', nested: 'y' }, mode: 'fast', kind: 'a', tags: ['a', 1] };
    expect(() => validateToolArguments(tool, { name: 'search', arguments: valid })).not.toThrow();
  });

  it('rejects invalid args (missing required) against a complex MCP schema', () => {
    const def: SvtonToolDefinition = { name: 'search', description: 'd', parameters: complexMcpParameters() };
    registry.register(def, recordingExecutor());
    const tool = buildAgentTools(registry, service, sink)[0];
    expect(() => validateToolArguments(tool, { name: 'search', arguments: { filter: { field: 'x' } } })).toThrow(/query/);
  });

  it('rejects an invalid nested $ref enum value', () => {
    const def: SvtonToolDefinition = { name: 'search', description: 'd', parameters: complexMcpParameters() };
    registry.register(def, recordingExecutor());
    const tool = buildAgentTools(registry, service, sink)[0];
    expect(() => validateToolArguments(tool, { name: 'search', arguments: { query: 'q', filter: { nested: 'z' } } })).toThrow();
  });
});

// ============================================================
// 2. MCP no-bypass — MCP-bridged tools go through ToolExecutionService
// ============================================================

describe('PI006 MCP tools use the same policy pipeline (no bypass)', () => {
  let registry: ToolRegistry;
  let platform: IPlatform;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;

  beforeEach(() => {
    registry = new ToolRegistry();
    platform = createMockPlatform();
    pendingApprovals = new Map();
  });

  /** Register an MCP-shaped tool exactly as `bridgeMcpTools` would. */
  function registerMcpTool(name: string, exec: IToolExecutor): void {
    registry.register(
      { name, description: `MCP ${name}`, parameters: { type: 'object', properties: {} }, annotations: { openWorldHint: true } },
      exec,
    );
  }

  it('denies an MCP tool under read_only permissions without executing it', async () => {
    const exec = recordingExecutor();
    registerMcpTool('mcp__srv__write', exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'read_only' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];

    const result = await tool.execute(call('mcp__srv__write').id, {});
    expect(exec.calls).toHaveLength(0);          // never reached the MCP executor
    expect(result.details).toMatchObject({ isError: true });
    expect((result.content[0] as { text: string }).text).toContain('Permission denied');
  });

  it('executes an MCP tool under auto permissions', async () => {
    const exec = recordingExecutor();
    registerMcpTool('mcp__srv__read', exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];

    const result = await tool.execute(call('mcp__srv__read').id, {});
    expect(exec.calls).toHaveLength(1);
    expect(result.isError).toBeFalsy();
  });
});
