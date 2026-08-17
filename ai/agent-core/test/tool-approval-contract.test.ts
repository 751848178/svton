import { describe, expect, it } from 'vitest';
import { ApprovalGate } from '../src/agent/approval-gate';
import { createToolApprovalRequest } from '../src/agent/tool-approval-request.utils';
import { ToolExecutionService } from '../src/agent/tool-executor';
import { PermissionManager } from '../src/permission/manager';
import { ToolRegistry } from '../src/tool/registry';
import type {
  SvtonToolDefinition,
  ToolCall,
  ToolContext,
  ToolResult,
} from '../src/tool/types';
import type { PermissionRule } from '../src/permission/types';
import type { SvtonCapabilityEvent } from '../src/agent/types';
import type {
  ToolApprovalDecision,
  ToolApprovalRequest,
} from '../src/agent/tool-approval.types';
import { createMockPlatform } from './helpers';

const SECRET = `ghp_${'a'.repeat(36)}`;
const definition: SvtonToolDefinition = {
  name: 'shell',
  description: 'Run a shell command',
  parameters: { type: 'object', properties: {} },
};

function createHarness(
  rules: PermissionRule[] = [{
    tool: 'shell', effect: 'ask', sessionScopeKey: 'shell.safe',
  }],
) {
  const calls: ToolCall[] = [];
  const registry = new ToolRegistry();
  registry.register(definition, {
    async execute(call: ToolCall, _context: ToolContext): Promise<ToolResult> {
      calls.push(call);
      return { callId: call.id, output: 'ran' };
    },
  });
  const permissions = new PermissionManager({ mode: 'default', rules });
  const gate = new ApprovalGate();
  const service = new ToolExecutionService(
    registry, createMockPlatform(), '/project', permissions, null,
    gate.pendingApprovals,
  );
  service.setExecOptions({ sessionId: 'session-a' });
  return { calls, gate, permissions, service };
}

async function readNeeded(
  generator: AsyncGenerator<SvtonCapabilityEvent, ToolResult>,
): Promise<ToolApprovalRequest> {
  const step = await generator.next();
  if (step.done || step.value.type !== 'tool_approval_needed') {
    throw new Error(`Expected approval request, received ${JSON.stringify(step.value)}`);
  }
  return step.value.request;
}

async function settle(
  harness: ReturnType<typeof createHarness>,
  generator: AsyncGenerator<SvtonCapabilityEvent, ToolResult>,
  request: ToolApprovalRequest,
  decision: ToolApprovalDecision,
) {
  expect(harness.gate.settleToolApproval(request.sessionId, request.requestId, decision)).toBe(true);
  expect(harness.gate.settleToolApproval(request.sessionId, request.requestId, decision)).toBe(false);
  const settled = await generator.next();
  expect(settled.done).toBe(false);
  expect(settled.value).toEqual(expect.objectContaining({
    type: 'tool_approval_settled',
    settlement: expect.objectContaining({
      requestId: request.requestId,
      sessionId: request.sessionId,
      itemId: request.itemId,
      decision,
    }),
  }));
  return generator.next();
}

describe('tool approval public/private contract', () => {
  it('redacts and bounds request data while executing the untouched raw call after accept', async () => {
    const harness = createHarness();
    const call: ToolCall = {
      id: 'call-secret',
      name: 'shell',
      arguments: {
        token: SECRET,
        nested: { command: `deploy --token=${SECRET}` },
        long: 'x'.repeat(5_000),
      },
    };
    const generator = harness.service.execute(call);
    const request = await readNeeded(generator);

    expect(request.sessionId).toBe('session-a');
    expect(request.decisions).toContain('acceptForSession');
    expect(JSON.stringify(request.arguments)).not.toContain(SECRET);
    expect(request.arguments.token).toBe('[REDACTED:field]');
    expect(String(request.arguments.long).length).toBeLessThanOrEqual(4_096);
    expect(request).not.toHaveProperty('call');

    const completed = await settle(harness, generator, request, 'accept');
    expect(completed.done).toBe(true);
    expect(completed.value.isError).toBeFalsy();
    expect(harness.calls).toEqual([call]);
    expect(harness.calls[0]?.arguments.token).toBe(SECRET);
  });

  it('redacts nested arguments, metadata, and policy reason in a bounded request', () => {
    const request = createToolApprovalRequest({
      call: {
        id: 'boundary', name: 'shell',
        arguments: { nested: { token: SECRET }, command: `run --token=${SECRET}` },
      },
      createdAt: 1,
      metadata: { auth: `Bearer ${SECRET}`, nested: { password: SECRET } },
      reason: `Policy credential=${SECRET} ${'r'.repeat(5_000)}`,
      sessionScopeKey: 'shell.safe',
    });
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain(SECRET);
    expect(request.reason?.length).toBeLessThanOrEqual(4_096);
    expect(request.metadata).toBeDefined();
  });

  it('normalizes unsupported primitives into JSON-safe public request data', () => {
    const request = createToolApprovalRequest({
      call: {
        id: 'json-safe', name: 'shell',
        arguments: {
          bigint: 42n, missing: undefined, callback: () => true,
          symbol: Symbol('unsafe'), infinite: Number.POSITIVE_INFINITY,
        },
      },
      createdAt: 1,
    });
    expect(() => JSON.stringify(request)).not.toThrow();
    expect(request.arguments).toMatchObject({
      bigint: '42', missing: null, callback: null, symbol: null, infinite: null,
    });
  });

  it('redacts and terminalizes cyclic request arguments and metadata', () => {
    const cyclicArguments: Record<string, unknown> = { password: 'raw-password' };
    const cyclicMetadata: Record<string, unknown> = { auth: 'token=raw-token' };
    cyclicArguments.self = cyclicArguments;
    cyclicMetadata.self = cyclicMetadata;
    const request = createToolApprovalRequest({
      call: { id: 'cyclic', name: 'shell', arguments: cyclicArguments },
      metadata: cyclicMetadata,
      createdAt: 1,
    });

    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('raw-password');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).toContain('[circular]');
  });
});

describe('tool approval settlements', () => {
  it.each([
    ['decline', 'Tool call rejected by user'],
    ['cancel', 'Tool call canceled by user'],
  ] as const)('returns typed safe metadata for %s', async (decision, output) => {
    const harness = createHarness();
    const generator = harness.service.execute({ id: decision, name: 'shell', arguments: {} });
    const request = await readNeeded(generator);
    const completed = await settle(harness, generator, request, decision);
    expect(completed.done).toBe(true);
    expect(completed.value).toEqual(expect.objectContaining({
      isError: true,
      output,
      metadata: {
        approval: {
          requestId: request.requestId,
          sessionId: request.sessionId,
          itemId: request.itemId,
          decision,
        },
      },
    }));
    expect(harness.calls).toHaveLength(0);
  });

  it('settles an aborted wait as interrupted and never executes', async () => {
    const harness = createHarness();
    const abort = new AbortController();
    const generator = harness.service.execute(
      { id: 'abort', name: 'shell', arguments: {} }, abort.signal,
    );
    const request = await readNeeded(generator);
    abort.abort();
    const settled = await generator.next();
    expect(settled.value).toEqual(expect.objectContaining({
      type: 'tool_approval_settled',
      settlement: expect.objectContaining({ decision: 'interrupted' }),
    }));
    const completed = await generator.next();
    expect(completed.value).toEqual(expect.objectContaining({
      isError: true,
      output: 'Tool call canceled because run was aborted',
      metadata: { approval: expect.objectContaining({ decision: 'interrupted' }) },
    }));
    expect(harness.calls).toHaveLength(0);
    expect(harness.gate.settleToolApproval(request.sessionId, request.requestId, 'accept')).toBe(false);
  });
});

describe('session-scoped approval grants', () => {
  it('applies only the exact validated policy scope in the exact session', async () => {
    const harness = createHarness();
    const first = harness.service.execute({ id: 'first', name: 'shell', arguments: {} });
    const request = await readNeeded(first);
    expect(request.sessionScopeKey).toBe('shell.safe');
    await settle(harness, first, request, 'acceptForSession');

    expect(harness.permissions.check(
      { id: 'same', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    )).toEqual(expect.objectContaining({ allowed: true, needsApproval: false }));
    expect(harness.permissions.check(
      { id: 'other', name: 'shell', arguments: {} }, { sessionId: 'session-b' },
    )).toEqual(expect.objectContaining({ needsApproval: true, sessionScopeKey: 'shell.safe' }));
  });

  it.each([undefined, 'invalid scope key!'])('omits invalid or absent scope %s', (scope) => {
    const permissions = new PermissionManager({
      mode: 'default', rules: [{ tool: 'shell', effect: 'ask', sessionScopeKey: scope }],
    });
    const decision = permissions.check(
      { id: 'scope', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    );
    expect(decision.needsApproval).toBe(true);
    expect(decision.sessionScopeKey).toBeUndefined();
    expect(permissions.grantForSession('session-a', scope)).toBe(false);
  });

  it('does not grant a default-mode approval and keeps explicit deny precedence', () => {
    const defaults = new PermissionManager({ mode: 'default' });
    expect(defaults.grantForSession('session-a', 'shell.safe')).toBe(false);
    expect(defaults.check(
      { id: 'default', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    ).sessionScopeKey).toBeUndefined();

    const denied = new PermissionManager({ mode: 'default', rules: [
      { tool: 'shell', effect: 'ask', sessionScopeKey: 'shell.safe' },
      { tool: 'shell', effect: 'deny' },
    ] });
    expect(denied.grantForSession('session-a', 'shell.safe')).toBe(true);
    expect(denied.check(
      { id: 'denied', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    )).toEqual(expect.objectContaining({ allowed: false, needsApproval: false }));
  });

  it('forks policy and mode without sharing session grants or later mutations', () => {
    const source = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'shell', effect: 'ask', sessionScopeKey: 'shell.safe' }],
    });
    expect(source.grantForSession('session-a', 'shell.safe')).toBe(true);
    const fork = source.forkForRuntime();

    expect(fork).not.toBe(source);
    expect(fork.getMode()).toBe('default');
    expect(fork.check(
      { id: 'fork', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    )).toEqual(expect.objectContaining({ needsApproval: true, sessionScopeKey: 'shell.safe' }));
    fork.setMode('auto');
    expect(source.getMode()).toBe('default');
  });

  it('downgrades acceptForSession to accept if policy is removed while pending', async () => {
    const harness = createHarness();
    const generator = harness.service.execute({ id: 'race', name: 'shell', arguments: {} });
    const request = await readNeeded(generator);
    harness.permissions.removeRule('shell');

    expect(harness.gate.settleToolApproval(
      request.sessionId, request.requestId, 'acceptForSession',
    )).toBe(true);
    const settled = await generator.next();
    expect(settled.value).toEqual(expect.objectContaining({
      type: 'tool_approval_settled',
      settlement: expect.objectContaining({ decision: 'accept' }),
    }));
    const completed = await generator.next();
    expect(completed.done).toBe(true);
    expect(harness.calls).toHaveLength(1);
    expect(harness.permissions.check(
      { id: 'after', name: 'shell', arguments: {} }, { sessionId: 'session-a' },
    )).toEqual(expect.objectContaining({ needsApproval: true }));
  });
});
