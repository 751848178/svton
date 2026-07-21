import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ToolRegistry,
  PermissionManager,
  ContextManager,
  AutoReviewerManager,
  HookManager,
} from '@svton/agent-core';
import { ToolExecutionService } from '../src/agent/tool-executor';
import type {
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
  ToolDefinition,
  SkillDefinition,
} from '@svton/agent-core';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

function createMockPlatform(): IPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
      documentPreview: false,
      computerUse: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

/** A tool executor that records calls and returns a fixed output */
function createRecordingExecutor(
  output: string = 'tool ran',
): IToolExecutor & { calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      calls.push(call);
      return { callId: call.id, output };
    },
  };
}

function makeToolDef(name: string): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { type: 'object', properties: {} },
  };
}

function makeToolCall(
  name: string,
  args: Record<string, unknown> = {},
): ToolCall {
  return {
    id: `call-${name}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    arguments: args,
  };
}

/**
 * Drain an async generator into an array.
 */
async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) {
    items.push(item);
  }
  return items;
}

// ==============================================================
// Tests
// ==============================================================

describe('F1+F13 — Tool Execution Pipeline (sandbox + auto-reviewer)', () => {
  let toolRegistry: ToolRegistry;
  let contextManager: ContextManager;
  let platform: IPlatform;
  let workingDir: string;
  let pendingApprovals: Map<string, { call: ToolCall; resolve: (v: boolean) => void; timestamp: number }>;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    contextManager = new ContextManager();
    platform = createMockPlatform();
    workingDir = '/project';
    pendingApprovals = new Map();
  });

  function createService(
    permissionManager: PermissionManager | null,
    autoReviewer: AutoReviewerManager | null = null,
    hookManager: HookManager | null = null,
  ): ToolExecutionService {
    const service = new ToolExecutionService(
      toolRegistry,
      contextManager,
      platform,
      workingDir,
      permissionManager,
      hookManager,
      pendingApprovals,
    );
    service.setExecOptions({
      autoReviewer,
      sessionId: 'test-session',
    });
    return service;
  }

  // ----------------------------------------------------------
  // Auto-reviewer auto-approve → skips user approval
  // ----------------------------------------------------------
  describe('auto-reviewer auto-approve', () => {
    it('skips user approval when auto-reviewer approves', async () => {
      // Register a tool that would normally need approval (bash)
      const exec = createRecordingExecutor('bash output');
      toolRegistry.register(makeToolDef('bash'), exec);

      // Permission mode "default" → bash needs approval
      const pm = new PermissionManager({ mode: 'default' });

      // Auto-reviewer that always approves
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'approve-all',
            description: 'Approve everything',
            verdict: 'approve',
            reason: 'auto',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      const events = await drain(service.execute(
        makeToolCall('bash', { command: 'ls' }),
      ));

      // Should NOT emit tool_approval_needed
      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);

      // Should have executed the tool
      expect(exec.calls).toHaveLength(1);

      // Should emit a tool_call_end with the result
      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
    });

    it('does not create a pending approval entry when auto-approved', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'ok',
            description: '',
            verdict: 'approve',
            reason: '',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      await drain(service.execute(makeToolCall('bash')));

      expect(pendingApprovals.size).toBe(0);
    });

    it('attaches auto-review verdict metadata to auto-approved tool results', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'allow-safe-bash',
            description: '',
            verdict: 'approve',
            reason: 'matches safe command',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      const events = await drain(service.execute(makeToolCall('bash', { command: 'ls' })));

      const endEvent = events.find((event) => event.type === 'tool_call_end');
      expect(endEvent).toBeDefined();
      if (endEvent?.type === 'tool_call_end') {
        expect(endEvent.result.metadata?.autoReviewVerdict).toEqual({
          verdict: 'approve',
          reason: 'matches safe command',
          ruleId: 'allow-safe-bash',
        });
      }
    });
  });

  describe('active skill tool gates', () => {
    it('blocks disallowed tools before requesting permission approval', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const service = createService(pm, null);
      const skill: SkillDefinition = {
        name: 'safe-skill',
        description: 'Disallow shell',
        instructions: '',
        scope: 'user',
        disallowedTools: ['bash'],
      };
      service.setActiveSkills([skill]);

      const gen = service.execute(makeToolCall('bash'));
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value.type).toBe('tool_call_end');
      if (first.value.type === 'tool_call_end') {
        expect(first.value.result.isError).toBe(true);
        expect(first.value.result.output).toContain('disallowed by active skill');
      }
      expect(exec.calls).toHaveLength(0);
      expect(pendingApprovals.size).toBe(0);

      const done = await gen.next();
      expect(done.done).toBe(true);
    });
  });

  describe('pre-tool hook modify', () => {
    it('executes the tool call modified by pre_tool_use hooks', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('file_read'), exec);
      const hookManager = new HookManager();
      hookManager.register({
        event: 'pre_tool_use',
        handler: async (ctx) => ({
          action: 'modify',
          updates: {
            toolCall: {
              ...(ctx.toolCall as ToolCall),
              arguments: { path: 'modified.txt' },
            },
          },
        }),
      });

      const service = createService(new PermissionManager({ mode: 'default' }), null, hookManager);

      await drain(service.execute(makeToolCall('file_read', { path: 'original.txt' })));

      expect(exec.calls).toHaveLength(1);
      expect(exec.calls[0].arguments).toEqual({ path: 'modified.txt' });
    });

    it('executes a partial tool call patch from pre_tool_use hooks', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('file_read'), exec);
      const hookManager = new HookManager();
      hookManager.register({
        event: 'pre_tool_use',
        handler: async () => ({
          action: 'modify',
          updates: {
            toolCall: {
              arguments: { path: 'patched-only.txt' },
            },
          },
        }),
      });

      const service = createService(new PermissionManager({ mode: 'default' }), null, hookManager);

      await drain(service.execute(makeToolCall('file_read', { path: 'original.txt' })));

      expect(exec.calls).toHaveLength(1);
      expect(exec.calls[0].name).toBe('file_read');
      expect(exec.calls[0].arguments).toEqual({ path: 'patched-only.txt' });
    });
  });

  // ----------------------------------------------------------
  // Auto-reviewer deny → returns error
  // ----------------------------------------------------------
  describe('auto-reviewer deny', () => {
    it('returns an error result without executing the tool', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });

      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'deny-all',
            description: 'Deny everything',
            verdict: 'deny',
            reason: 'Dangerous',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      const events = await drain(service.execute(
        makeToolCall('bash', { command: 'rm -rf /' }),
      ));

      // Should NOT execute the tool
      expect(exec.calls).toHaveLength(0);

      // Should emit tool_call_end with isError=true
      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
      const result = (endEvents[0] as any).result as ToolResult;
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Auto-reviewer denied');
      expect(result.output).toContain('Dangerous');
    });

    it('does not request user approval when denied', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'deny',
            description: '',
            verdict: 'deny',
            reason: 'no',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      const events = await drain(service.execute(makeToolCall('bash')));

      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);
      expect(pendingApprovals.size).toBe(0);
    });

    it('attaches auto-review verdict metadata to denied tool results', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [
          {
            id: 'deny-dangerous-bash',
            description: 'Deny dangerous commands',
            verdict: 'deny',
            reason: 'Dangerous',
            matches: () => true,
          },
        ],
      });

      const service = createService(pm, reviewer);
      const events = await drain(service.execute(makeToolCall('bash', { command: 'rm -rf /' })));

      const endEvent = events.find((event) => event.type === 'tool_call_end');
      expect(endEvent).toBeDefined();
      if (endEvent?.type === 'tool_call_end') {
        expect(endEvent.result.isError).toBe(true);
        expect(endEvent.result.metadata?.autoReviewVerdict).toEqual({
          verdict: 'deny',
          reason: 'Dangerous',
          ruleId: 'deny-dangerous-bash',
        });
      }
    });
  });

  // ----------------------------------------------------------
  // Auto-reviewer ask_user → falls through to user approval
  // ----------------------------------------------------------
  describe('auto-reviewer ask_user', () => {
    it('emits tool_approval_needed when reviewer says ask_user', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });

      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [], // No rules → ask_user
      });

      const service = createService(pm, reviewer);

      // Start execution (returns a generator)
      const gen = service.execute(makeToolCall('bash'));
      const first = await gen.next();

      // First event should be tool_approval_needed
      expect(first.value.type).toBe('tool_approval_needed');
      if (first.value.type === 'tool_approval_needed') {
        expect(first.value.metadata?.autoReviewVerdict).toEqual({
          verdict: 'ask_user',
          reason: 'No matching rule',
          ruleId: undefined,
        });
      }
      expect(pendingApprovals.size).toBe(1);

      for (const [, entry] of pendingApprovals) {
        entry.resolve(false);
      }
      pendingApprovals.clear();
      await gen.next();
    });

    it('attaches auto-review verdict metadata when the escalated approval is rejected', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [],
      });

      const service = createService(pm, reviewer);
      const gen = service.execute(makeToolCall('bash'));

      const approvalEvent = await gen.next();
      expect(approvalEvent.value.type).toBe('tool_approval_needed');
      for (const [, entry] of pendingApprovals) {
        entry.resolve(false);
      }
      pendingApprovals.clear();

      const rejectedEvent = await gen.next();
      expect(rejectedEvent.value.type).toBe('tool_call_end');
      if (rejectedEvent.value.type === 'tool_call_end') {
        expect(rejectedEvent.value.result.isError).toBe(true);
        expect(rejectedEvent.value.result.metadata?.autoReviewVerdict).toEqual({
          verdict: 'ask_user',
          reason: 'No matching rule',
          ruleId: undefined,
        });
      }
    });

    it('attaches auto-review verdict metadata when the escalated approval is approved', async () => {
      const exec = createRecordingExecutor('approved run');
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [],
      });

      const service = createService(pm, reviewer);
      const gen = service.execute(makeToolCall('bash'));

      const approvalEvent = await gen.next();
      expect(approvalEvent.value.type).toBe('tool_approval_needed');
      for (const [, entry] of pendingApprovals) {
        entry.resolve(true);
      }
      pendingApprovals.clear();

      const approvedEvent = await gen.next();
      expect(approvedEvent.value.type).toBe('tool_call_end');
      if (approvedEvent.value.type === 'tool_call_end') {
        expect(approvedEvent.value.result.isError).toBeFalsy();
        expect(approvedEvent.value.result.metadata?.autoReviewVerdict).toEqual({
          verdict: 'ask_user',
          reason: 'No matching rule',
          ruleId: undefined,
        });
      }
      expect(exec.calls).toHaveLength(1);
    });

    it('does not request approval after ask_user when the run signal is already aborted', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const reviewer = new AutoReviewerManager({
        mode: 'auto_review',
        rules: [],
      });
      const controller = new AbortController();
      controller.abort();

      const service = createService(pm, reviewer);
      service.setExecOptions({
        autoReviewer: reviewer,
        sessionId: 'aborted-session',
        signal: controller.signal,
      });

      const events = await drain(service.execute(makeToolCall('bash')));

      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);
      expect(pendingApprovals.size).toBe(0);
      expect(exec.calls).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // setExecOptions()
  // ----------------------------------------------------------
  describe('setExecOptions()', () => {
    it('updates the autoReviewer', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });

      const service = new ToolExecutionService(
        toolRegistry,
        contextManager,
        platform,
        workingDir,
        pm,
        null,
        pendingApprovals,
      );

      // Initially no auto-reviewer → should ask user
      service.setExecOptions({});
      const gen = service.execute(makeToolCall('bash'));
      const first = await gen.next();
      expect(first.value.type).toBe('tool_approval_needed');
      // Clean up the pending approval
      pendingApprovals.clear();

      // Now set an auto-reviewer that approves everything
      service.setExecOptions({
        autoReviewer: new AutoReviewerManager({
          mode: 'auto_review',
          rules: [
            {
              id: 'all',
              description: '',
              verdict: 'approve',
              reason: '',
              matches: () => true,
            },
          ],
        }),
      });

      // Reset executor call tracking
      exec.calls.length = 0;
      const events = await drain(service.execute(makeToolCall('bash')));

      // Should execute without approval
      expect(exec.calls).toHaveLength(1);
      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);
    });

    it('includes sessionId from execOptions in tool context', async () => {
      const capturedCtx: ToolContext[] = [];
      const exec: IToolExecutor = {
        execute: async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
          capturedCtx.push(ctx);
          return { callId: call.id, output: 'ok' };
        },
      };
      toolRegistry.register(makeToolDef('file_read'), exec);

      // file_read doesn't need approval in any mode
      const pm = new PermissionManager({ mode: 'default' });

      const service = new ToolExecutionService(
        toolRegistry,
        contextManager,
        platform,
        workingDir,
        pm,
        null,
        pendingApprovals,
      );

      service.setExecOptions({ sessionId: 'my-custom-session' });

      await drain(service.execute(makeToolCall('file_read')));

      expect(capturedCtx).toHaveLength(1);
      expect(capturedCtx[0].sessionId).toBe('my-custom-session');
    });

    it('does not execute tools when the run signal is already aborted', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('file_read'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const controller = new AbortController();
      controller.abort();

      const service = createService(pm, null);
      service.setExecOptions({
        sessionId: 'aborted-session',
        signal: controller.signal,
      });

      const events = await drain(service.execute(makeToolCall('file_read')));

      expect(exec.calls).toHaveLength(0);
      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
      const result = (endEvents[0] as any).result as ToolResult;
      expect(result.isError).toBe(true);
      expect(result.output).toContain('run was aborted');
    });

    it('includes sandbox options from execOptions in tool context', async () => {
      const capturedCtx: ToolContext[] = [];
      const sandboxProfile: SandboxProfile = {
        mode: 'workspace_write',
        writablePaths: ['/project'],
        networkAccess: false,
      };
      const exec: IToolExecutor = {
        execute: async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
          capturedCtx.push(ctx);
          return { callId: call.id, output: 'ok' };
        },
      };
      toolRegistry.register(makeToolDef('file_read'), exec);

      const pm = new PermissionManager({ mode: 'default' });
      const service = new ToolExecutionService(
        toolRegistry,
        contextManager,
        platform,
        workingDir,
        pm,
        null,
        pendingApprovals,
      );

      service.setExecOptions({ sandboxProfile, sandboxRequired: true, sessionId: 'sandbox-session' });

      await drain(service.execute(makeToolCall('file_read')));

      expect(capturedCtx).toHaveLength(1);
      expect(capturedCtx[0].sandboxProfile).toBe(sandboxProfile);
      expect(capturedCtx[0].sandboxRequired).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Permission deny (without auto-reviewer)
  // ----------------------------------------------------------
  describe('permission check without auto-reviewer', () => {
    it('denies the tool call when permission check fails', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);

      // read_only mode denies bash
      const pm = new PermissionManager({ mode: 'read_only' });

      const service = createService(pm, null);
      const events = await drain(service.execute(makeToolCall('bash')));

      // Should NOT execute
      expect(exec.calls).toHaveLength(0);

      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
      const result = (endEvents[0] as any).result as ToolResult;
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Permission denied');
    });

    it('writes the same permission-denied fallback output to context when no reason is provided', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = {
        check: vi.fn(() => ({ allowed: false, needsApproval: false })),
      } as unknown as PermissionManager;

      const service = createService(pm, null);
      const events = await drain(service.execute(makeToolCall('bash')));

      expect(exec.calls).toHaveLength(0);
      const endEvent = events.find((e) => e.type === 'tool_call_end');
      expect(endEvent?.type).toBe('tool_call_end');
      const result = (endEvent as any).result as ToolResult;
      expect(result.output).toBe('Permission denied: not allowed');
      const contextMessages = contextManager.getMessages();
      const contextResult = (contextMessages.at(-1)?.content as any[])[0];
      expect(contextResult.output).toBe(result.output);
      expect(contextResult.output).not.toContain('undefined');
    });

    it('does not request approval when the run signal is already aborted', async () => {
      const exec = createRecordingExecutor();
      toolRegistry.register(makeToolDef('bash'), exec);
      const pm = new PermissionManager({ mode: 'default' });
      const controller = new AbortController();
      controller.abort();

      const service = createService(pm, null);
      service.setExecOptions({
        sessionId: 'aborted-session',
        signal: controller.signal,
      });

      const events = await drain(service.execute(makeToolCall('bash')));

      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);
      expect(pendingApprovals.size).toBe(0);
      expect(exec.calls).toHaveLength(0);

      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
      const result = (endEvents[0] as any).result as ToolResult;
      expect(result.isError).toBe(true);
      expect(result.output).toContain('run was aborted');
    });
  });

  // ----------------------------------------------------------
  // Read-only tools bypass approval
  // ----------------------------------------------------------
  describe('read-only tools', () => {
    it('executes file_read without approval even in default mode', async () => {
      const exec = createRecordingExecutor('file content');
      toolRegistry.register(makeToolDef('file_read'), exec);
      const pm = new PermissionManager({ mode: 'default' });

      const service = createService(pm, null);
      const events = await drain(service.execute(makeToolCall('file_read')));

      // Should execute
      expect(exec.calls).toHaveLength(1);

      // Should NOT emit approval needed
      expect(events.some((e) => e.type === 'tool_approval_needed')).toBe(false);

      // Should have tool_call_end with the result
      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toHaveLength(1);
    });
  });
});
