/**
 * PI005 — Pi tool adapter bridge tests.
 *
 * Covers the Pi-owned vs svton-owned contract surface in `pi-tool-adapter.ts`:
 *   - executionMode mapping (annotations → sequential/parallel) per §5.3
 *   - schema normalization (annotations stripped, type/properties guaranteed)
 *   - onUpdate streaming bridge (Pi onUpdate → executor onProgress → tool_call_progress)
 *   - NO bypass: every AgentTool.execute() drains the ToolExecutionService policy
 *     pipeline (permission/approval/auto-review/sandbox/hooks). A denied tool
 *     never executes; an approved tool does; an auto-review-deny blocks; hook
 *     order is pre → exec → post.
 *
 * These tests build the `AgentTool[]` from a `ToolRegistry` + real
 * `ToolExecutionService` (same mocks the pipeline test uses) and drive the
 * returned `execute()` directly — proving the bridge is the only entry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRegistry,
  PermissionManager,
  AutoReviewerManager,
  HookManager,
} from '@svton/agent-core';
import { ToolExecutionService } from '../src/agent/tool-executor';
import { buildAgentTools } from '../src/agent/pi-tool-adapter';
import type { ToolEventSink } from '../src/agent/pi-tool-adapter';
import type { AgentEvent } from '../src/agent/types';
import type {
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
  ToolDefinition,
  ToolAnnotations,
} from '@svton/agent-core';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';
import type { AgentTool } from '@earendil-works/pi-agent-core';

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

function recordingExecutor(output = 'ran', opts?: { onProgress?: (m: string) => void }): IToolExecutor & { calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
      calls.push(call);
      if (opts?.onProgress) {
        // Surface the ctx.onProgress seam so the streaming bridge test sees it.
        opts.onProgress('streaming-partial');
        ctx.onProgress?.('ctx-progress-1');
        ctx.onProgress?.('ctx-progress-2');
      }
      return { callId: call.id, output };
    },
  };
}

function def(name: string, annotations?: ToolAnnotations): ToolDefinition {
  return { name, description: `Tool ${name}`, parameters: { type: 'object', properties: {} }, annotations };
}

function call(name: string): ToolCall {
  return { id: `call-${name}-${Math.random().toString(36).slice(2, 6)}`, name, arguments: {} };
}

async function drain(g: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of g) out.push(ev);
  return out;
}

// ============================================================
// executionMode mapping (Architecture §5.3)
// ============================================================

describe('PI005 executionMode mapping (annotations → sequential/parallel)', () => {
  let registry: ToolRegistry;
  let service: ToolExecutionService;
  const sink: ToolEventSink = () => {};

  beforeEach(() => {
    registry = new ToolRegistry();
    service = new ToolExecutionService(
      registry, createMockPlatform(), '/project',
      new PermissionManager({ mode: 'auto' }), null, new Map(),
    );
  });

  it('marks a destructive tool sequential', () => {
    registry.register(def('rm_rf', { destructiveHint: true }), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    const tool = tools.find((t) => t.name === 'rm_rf')!;
    expect(tool.executionMode).toBe('sequential');
  });

  it('marks a proven read-only tool parallel', () => {
    registry.register(def('grep', { readOnlyHint: true }), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    const tool = tools.find((t) => t.name === 'grep')!;
    expect(tool.executionMode).toBe('parallel');
  });

  it('forces sequential when both readOnly and destructive are set', () => {
    registry.register(def('ambig', { readOnlyHint: true, destructiveHint: true }), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    const tool = tools.find((t) => t.name === 'ambig')!;
    expect(tool.executionMode).toBe('sequential');
  });

  it('leaves executionMode undefined when no relevant annotations (falls back to global sequential)', () => {
    registry.register(def('plain'), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    const tool = tools.find((t) => t.name === 'plain')!;
    expect(tool.executionMode).toBeUndefined();
  });

  it('a batch of read-only tools can all be marked parallel', () => {
    registry.register(def('grep', { readOnlyHint: true }), recordingExecutor());
    registry.register(def('glob', { readOnlyHint: true }), recordingExecutor());
    registry.register(def('file_read', { readOnlyHint: true }), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    expect(tools.every((t) => t.executionMode === 'parallel')).toBe(true);
  });

  it('a destructive tool in an otherwise read-only batch forces sequential for itself', () => {
    registry.register(def('grep', { readOnlyHint: true }), recordingExecutor());
    registry.register(def('bash', { destructiveHint: true }), recordingExecutor());
    const tools = buildAgentTools(registry, service, sink);
    expect(tools.find((t) => t.name === 'grep')!.executionMode).toBe('parallel');
    expect(tools.find((t) => t.name === 'bash')!.executionMode).toBe('sequential');
  });
});

// ============================================================
// Schema normalization
// ============================================================

describe('PI005 schema normalization', () => {
  let registry: ToolRegistry;
  let service: ToolExecutionService;
  const sink: ToolEventSink = () => {};

  beforeEach(() => {
    registry = new ToolRegistry();
    service = new ToolExecutionService(
      registry, createMockPlatform(), '/project',
      new PermissionManager({ mode: 'auto' }), null, new Map(),
    );
  });

  it('strips svton-only annotations from the LLM-visible parameters', () => {
    registry.register(
      { name: 't', description: 'd', parameters: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }, annotations: { readOnlyHint: true } },
      recordingExecutor(),
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const params = tool.parameters as unknown as Record<string, unknown>;
    expect(params.annotations).toBeUndefined();
    expect(params.type).toBe('object');
    expect(params.properties).toEqual({ a: { type: 'string' } });
    expect(params.required).toEqual(['a']);
  });

  it('guarantees type:object + properties when missing', () => {
    registry.register(
      { name: 't', description: 'd', parameters: {} as any },
      recordingExecutor(),
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const params = tool.parameters as unknown as Record<string, unknown>;
    expect(params.type).toBe('object');
    expect(params.properties).toEqual({});
  });

  it('does not mutate the registry-stored definition', () => {
    const original = { type: 'object', properties: { x: { type: 'number' } }, annotations: { destructiveHint: true } } as any;
    registry.register({ name: 't', description: 'd', parameters: original }, recordingExecutor());
    buildAgentTools(registry, service, sink);
    // The original object passed in keeps its annotations (normalize copies).
    expect(original.annotations).toEqual({ destructiveHint: true });
  });
});

// ============================================================
// onUpdate streaming bridge
// ============================================================

describe('PI005 onUpdate streaming bridge', () => {
  let registry: ToolRegistry;
  let platform: IPlatform;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;
  const sink: ToolEventSink = () => {};

  beforeEach(() => {
    registry = new ToolRegistry();
    platform = createMockPlatform();
    pendingApprovals = new Map();
  });

  it('forwards ToolContext.onProgress messages to Pi onUpdate', async () => {
    const exec = recordingExecutor('done', { onProgress: () => {} });
    registry.register(def('streamy', { readOnlyHint: true }), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];

    const updates: string[] = [];
    const onUpdate = (partial: { content?: Array<{ type: string; text?: string }> }) => {
      const text = (partial.content ?? []).map((c) => c.text ?? '').join('');
      updates.push(text);
    };
    await tool.execute('call-1', {}, undefined, onUpdate as any);

    // The executor called onProgress twice with ctx.onProgress; both surface.
    expect(updates).toEqual(['ctx-progress-1', 'ctx-progress-2']);
  });

  it('omits onProgress entirely when Pi does not supply onUpdate', async () => {
    const seen: string[] = [];
    const exec: IToolExecutor = {
      execute: async (c, ctx) => { ctx.onProgress?.('should-not-fire'); seen.push('exec'); return { callId: c.id, output: 'ok' }; },
    };
    registry.register(def('quiet'), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    await tool.execute('call-1', {}); // no onUpdate
    expect(seen).toEqual(['exec']); // still executed; onProgress was a no-op
  });

  it('a throwing onUpdate never breaks tool execution', async () => {
    const exec = recordingExecutor('done', { onProgress: () => {} });
    registry.register(def('flaky'), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const result = await tool.execute('call-1', {}, undefined, (() => { throw new Error('boom'); }) as any);
    expect(result.isError).toBeFalsy();
    expect(exec.calls).toHaveLength(1);
  });
});

// ============================================================
// NO BYPASS — every AgentTool.execute() drains the policy pipeline
// ============================================================

describe('PI005 security pipeline is the only execution path (no bypass)', () => {
  let registry: ToolRegistry;
  let platform: IPlatform;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;
  let recorded: Array<{ callId: string; output: string; isError?: boolean }>;
  const sink: ToolEventSink = () => {};

  beforeEach(() => {
    registry = new ToolRegistry();
    platform = createMockPlatform();
    pendingApprovals = new Map();
    recorded = [];
  });

  function makeService(pm: PermissionManager | null, reviewer: AutoReviewerManager | null = null, hooks: HookManager | null = null): { service: ToolExecutionService; tools: AgentTool[] } {
    const service = new ToolExecutionService(
      registry, platform, '/project', pm, hooks, pendingApprovals,
      (callId, output, isError) => recorded.push({ callId, output, isError }),
    );
    service.setExecOptions({ autoReviewer: reviewer, sessionId: 's' });
    const tools = buildAgentTools(registry, service, sink);
    return { service, tools };
  }

  it('denies a permission-denied tool without executing it', async () => {
    const exec = recordingExecutor();
    registry.register(def('bash'), exec);
    const { tools } = makeService(new PermissionManager({ mode: 'read_only' }));
    const tool = tools.find((t) => t.name === 'bash')!;

    const result = await tool.execute(call('bash').id, {});
    expect(exec.calls).toHaveLength(0);          // never executed
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Permission denied');
  });

  it('executes an approved (read-only) tool', async () => {
    const exec = recordingExecutor('content');
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const { tools } = makeService(new PermissionManager({ mode: 'default' }));
    const tool = tools.find((t) => t.name === 'file_read')!;

    const result = await tool.execute(call('file_read').id, {});
    expect(exec.calls).toHaveLength(1);
    expect(result.isError).toBeFalsy();
  });

  it('blocks when the auto-reviewer denies', async () => {
    const exec = recordingExecutor();
    registry.register(def('bash'), exec);
    const reviewer = new AutoReviewerManager({
      mode: 'auto_review',
      rules: [{ id: 'deny', description: '', verdict: 'deny', reason: 'dangerous', matches: () => true }],
    });
    const { tools } = makeService(new PermissionManager({ mode: 'default' }), reviewer);
    const tool = tools.find((t) => t.name === 'bash')!;

    const result = await tool.execute(call('bash').id, {});
    expect(exec.calls).toHaveLength(0);          // never executed
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Auto-reviewer denied');
  });

  it('runs pre → exec → post hooks in order', async () => {
    const order: string[] = [];
    const wrappedExec: IToolExecutor = {
      execute: async (c, ctx) => { order.push('exec'); return recordingExecutor('ok').execute(c, ctx); },
    };
    registry.register(def('file_read', { readOnlyHint: true }), wrappedExec);
    const hooks = new HookManager();
    hooks.register({ event: 'pre_tool_use', handler: async () => { order.push('pre'); return { action: 'continue' as const }; } });
    hooks.register({ event: 'post_tool_use', handler: async () => { order.push('post'); return { action: 'continue' as const }; } });
    const { tools } = makeService(new PermissionManager({ mode: 'default' }), null, hooks);
    const tool = tools.find((t) => t.name === 'file_read')!;

    await tool.execute(call('file_read').id, {});
    expect(order).toEqual(['pre', 'exec', 'post']);
  });

  it('routes a sandbox-required tool context through the sandbox profile', async () => {
    const captured: ToolContext[] = [];
    const exec: IToolExecutor = { execute: async (c, ctx) => { captured.push(ctx); return { callId: c.id, output: 'ok' }; } };
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const profile: SandboxProfile = { mode: 'workspace_write', writablePaths: ['/project'], networkAccess: false };
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'default' }), null, pendingApprovals,
      (callId, output, isError) => recorded.push({ callId, output, isError }),
    );
    service.setExecOptions({ sandboxProfile: profile, sandboxRequired: true, sessionId: 's' });
    const tool = buildAgentTools(registry, service, sink)[0];

    await tool.execute(call('file_read').id, {});
    expect(captured[0].sandboxProfile).toBe(profile);
    expect(captured[0].sandboxRequired).toBe(true);
  });

  it('forwards every yielded pipeline event to the ToolEventSink', async () => {
    const exec = recordingExecutor();
    registry.register(def('bash'), exec);
    const events: AgentEvent[] = [];
    const capturingSink: ToolEventSink = (ev) => events.push(ev);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'read_only' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, capturingSink)[0];

    await tool.execute(call('bash').id, {});
    // Permission-denied path yields a tool_call_end event through the sink.
    expect(events.some((e) => e.type === 'tool_call_end')).toBe(true);
  });
});

// ============================================================
// Redaction + audit seam (Architecture §5.3)
// ============================================================

describe('PI005 redaction + audit seam', () => {
  let registry: ToolRegistry;
  let platform: IPlatform;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;
  const sink: ToolEventSink = () => {};

  beforeEach(() => {
    registry = new ToolRegistry();
    platform = createMockPlatform();
    pendingApprovals = new Map();
  });

  it('scrubs structured secrets by default via the built-in redactor', async () => {
    // The default is no longer identity: a real AWS key shape is scrubbed even
    // when no redactor is explicitly installed.
    const exec = recordingExecutor('roleArn config uses key AKIAIOSFODNN7EXAMPLE');
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const result = await tool.execute(call('file_read').id, {});
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(text).toContain('[REDACTED:aws-key]');
  });

  it('leaves non-secret plain text untouched by default', async () => {
    // Plain words like "secret-token" are NOT a structured secret shape, so the
    // default scrubber passes them through (low false-positive design).
    const exec = recordingExecutor('secret-token');
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const result = await tool.execute(call('file_read').id, {});
    expect((result.content[0] as { text: string }).text).toBe('secret-token');
  });

  it('applies an installed redactor to the yielded result', async () => {
    const exec = recordingExecutor('my-secret-key-123');
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    service.setRedactor((_c, result) => ({ ...result, output: result.output.replace(/my-secret-key-123/g, '[REDACTED]') }));
    const tool = buildAgentTools(registry, service, sink)[0];

    const result = await tool.execute(call('file_read').id, {});
    expect((result.content[0] as { text: string }).text).toBe('[REDACTED]');
  });

  it('survives a throwing redactor (falls back to unredacted result)', async () => {
    const exec = recordingExecutor('data');
    registry.register(def('file_read', { readOnlyHint: true }), exec);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pendingApprovals,
    );
    service.setRedactor(() => { throw new Error('redactor broken'); });
    const tool = buildAgentTools(registry, service, sink)[0];

    const result = await tool.execute(call('file_read').id, {});
    expect((result.content[0] as { text: string }).text).toBe('data');
  });
});
