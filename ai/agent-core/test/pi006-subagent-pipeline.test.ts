/**
 * PI006 — Subagent tools flow through the same policy pipeline (no bypass).
 *
 * Tools kept by `buildSubagentToolRegistry` (the restricted registry a
 * subagent's `SvtonAgentRuntime` child receives) are wrapped by the SAME
 * `buildAgentTools` → `ToolExecutionService` path as builtin tools, so the
 * permission/approval/auto-review/sandbox/hooks gates are enforced uniformly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, PermissionManager } from '@svton/agent-core';
import { ToolExecutionService } from '../src/agent/tool-executor';
import { buildAgentTools, type ToolEventSink } from '../src/agent/pi-tool-adapter';
import { buildSubagentToolRegistry } from '../src/subagent/subagent-config.utils';
import type { ToolCall, ToolResult, IToolExecutor } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

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
      return { callId: call.id, output: 'ran' };
    },
  };
}

function call(name: string): ToolCall {
  return { id: `call-${name}-${Math.random().toString(36).slice(2, 6)}`, name, arguments: {} };
}

const sink: ToolEventSink = () => {};

describe('PI006 subagent tools use the same policy pipeline (no bypass)', () => {
  let platform: IPlatform;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;

  beforeEach(() => {
    platform = createMockPlatform();
    pendingApprovals = new Map();
  });

  it('a tool kept by buildSubagentToolRegistry is still gated by the pipeline', async () => {
    const parent = new ToolRegistry();
    const exec = recordingExecutor();
    // `bash` is a mutating/shell tool — blocked under read_only mode.
    parent.register(
      { name: 'bash', description: 'shell', parameters: { type: 'object', properties: {} } },
      exec,
    );
    // Subagent allowlist keeps bash.
    const subRegistry = buildSubagentToolRegistry(parent, { task: 't', tools: ['bash'] });
    expect(subRegistry.listDefinitions().map((d) => d.name)).toEqual(['bash']);

    const service = new ToolExecutionService(
      subRegistry, platform, '/project',
      new PermissionManager({ mode: 'read_only' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(subRegistry, service, sink)[0];

    const result = await tool.execute(call('bash').id, {});
    expect(exec.calls).toHaveLength(0);          // permission gate blocked it
    expect(result.isError).toBe(true);
  });

  it('a tool excluded by buildSubagentToolRegistry is absent from the AgentTool set', async () => {
    const parent = new ToolRegistry();
    parent.register(
      { name: 'bash', description: 'shell', parameters: { type: 'object', properties: {} } },
      recordingExecutor(),
    );
    parent.register(
      { name: 'file_read', description: 'read', parameters: { type: 'object', properties: {} } },
      recordingExecutor(),
    );
    const subRegistry = buildSubagentToolRegistry(parent, { task: 't', excludeTools: ['bash'] });
    const names = subRegistry.listDefinitions().map((d) => d.name);
    expect(names).toContain('file_read');
    expect(names).not.toContain('bash');
  });
});
