import { describe, it, expect, vi } from 'vitest';
import {
  HookManager,
  type HookEvent,
  type HookContext,
  type HookResult,
  type HookHandler,
  type HookConfig,
} from '@svton/agent-core';

// Helpers
const makeContext = (overrides: Partial<HookContext> = {}): HookContext => ({
  event: 'pre_tool_use',
  ...overrides,
});

const continueHook: HookHandler = async () => ({ action: 'continue' });
const approveHook: HookHandler = async () => ({ action: 'approve' });
const denyHook = (reason: string): HookHandler => async () => ({ action: 'deny', reason });
const modifyHook = (updates: Record<string, unknown>): HookHandler => async () => ({
  action: 'modify',
  updates,
});

// ============================================================
// register
// ============================================================
describe('HookManager - register', () => {
  it('returns a hook ID (auto-generated)', () => {
    const hm = new HookManager();
    const id = hm.register({ event: 'pre_tool_use', handler: continueHook });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('returns unique IDs for multiple hooks', () => {
    const hm = new HookManager();
    const id1 = hm.register({ event: 'pre_tool_use', handler: continueHook });
    const id2 = hm.register({ event: 'pre_tool_use', handler: continueHook });
    expect(id1).not.toBe(id2);
  });

  it('uses the provided ID if specified', () => {
    const hm = new HookManager();
    const id = hm.register({ event: 'pre_tool_use', handler: continueHook, id: 'my-hook' });
    expect(id).toBe('my-hook');
  });

  it('allows registering hooks for different events', () => {
    const hm = new HookManager();
    const id1 = hm.register({ event: 'pre_tool_use', handler: continueHook });
    const id2 = hm.register({ event: 'post_tool_use', handler: continueHook });
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});

// ============================================================
// trigger - priority ordering
// ============================================================
describe('HookManager - trigger priority ordering', () => {
  it('calls hooks in priority order (lower number first)', async () => {
    const hm = new HookManager();
    const order: number[] = [];

    hm.register({ event: 'pre_tool_use', handler: async () => { order.push(3); return { action: 'continue' }; }, priority: 30 });
    hm.register({ event: 'pre_tool_use', handler: async () => { order.push(1); return { action: 'continue' }; }, priority: 10 });
    hm.register({ event: 'pre_tool_use', handler: async () => { order.push(2); return { action: 'continue' }; }, priority: 20 });

    await hm.trigger('pre_tool_use', makeContext());
    expect(order).toEqual([1, 2, 3]);
  });

  it('default priority is 100 when not specified', async () => {
    const hm = new HookManager();
    const order: string[] = [];

    hm.register({ event: 'pre_tool_use', handler: async () => { order.push('default'); return { action: 'continue' }; } });
    hm.register({ event: 'pre_tool_use', handler: async () => { order.push('low'); return { action: 'continue' }; }, priority: 1 });

    await hm.trigger('pre_tool_use', makeContext());
    expect(order).toEqual(['low', 'default']);
  });

  it('hooks with same priority are called in registration order', async () => {
    const hm = new HookManager();
    const order: string[] = [];

    hm.register({ event: 'pre_tool_use', handler: async () => { order.push('a'); return { action: 'continue' }; }, priority: 10 });
    hm.register({ event: 'pre_tool_use', handler: async () => { order.push('b'); return { action: 'continue' }; }, priority: 10 });
    hm.register({ event: 'pre_tool_use', handler: async () => { order.push('c'); return { action: 'continue' }; }, priority: 10 });

    await hm.trigger('pre_tool_use', makeContext());
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================
// trigger - deny action
// ============================================================
describe('HookManager - trigger deny action', () => {
  it('stops execution and returns deny when a hook returns deny', async () => {
    const hm = new HookManager();
    const secondCalled = vi.fn();

    hm.register({ event: 'pre_tool_use', handler: denyHook('forbidden'), priority: 1 });
    hm.register({ event: 'pre_tool_use', handler: async () => { secondCalled(); return { action: 'continue' }; }, priority: 10 });

    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'deny', reason: 'forbidden' });
    expect(secondCalled).not.toHaveBeenCalled();
  });

  it('deny from a later-priority hook still stops the chain', async () => {
    const hm = new HookManager();
    const firstCalled = vi.fn();
    const thirdCalled = vi.fn();

    hm.register({ event: 'pre_tool_use', handler: async () => { firstCalled(); return { action: 'continue' }; }, priority: 1 });
    hm.register({ event: 'pre_tool_use', handler: denyHook('stop here'), priority: 10 });
    hm.register({ event: 'pre_tool_use', handler: async () => { thirdCalled(); return { action: 'continue' }; }, priority: 20 });

    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'deny', reason: 'stop here' });
    expect(firstCalled).toHaveBeenCalled();
    expect(thirdCalled).not.toHaveBeenCalled();
  });
});

// ============================================================
// trigger - modify action
// ============================================================
describe('HookManager - trigger modify action', () => {
  it('applies updates to context and continues', async () => {
    const hm = new HookManager();
    let receivedToolName: string | undefined;

    hm.register({
      event: 'pre_tool_use',
      handler: modifyHook({ toolName: 'modified_tool' }),
      priority: 1,
    });
    hm.register({
      event: 'pre_tool_use',
      handler: async (ctx) => { receivedToolName = ctx.toolName; return { action: 'continue' }; },
      priority: 10,
    });

    const ctx = makeContext({ toolName: 'original_tool' });
    await hm.trigger('pre_tool_use', ctx);
    expect(receivedToolName).toBe('modified_tool');
  });

  it('multiple modify hooks accumulate updates', async () => {
    const hm = new HookManager();
    let finalValue1: unknown;
    let finalValue2: unknown;

    hm.register({
      event: 'pre_tool_use',
      handler: modifyHook({ key1: 'val1' }),
      priority: 1,
    });
    hm.register({
      event: 'pre_tool_use',
      handler: modifyHook({ key2: 'val2' }),
      priority: 10,
    });
    hm.register({
      event: 'pre_tool_use',
      handler: async (ctx) => { finalValue1 = ctx.key1; finalValue2 = ctx.key2; return { action: 'continue' }; },
      priority: 20,
    });

    await hm.trigger('pre_tool_use', makeContext());
    expect(finalValue1).toBe('val1');
    expect(finalValue2).toBe('val2');
  });
});

// ============================================================
// trigger - continue and approve
// ============================================================
describe('HookManager - trigger continue and approve', () => {
  it('continue proceeds to the next hook', async () => {
    const hm = new HookManager();
    const callOrder: string[] = [];

    hm.register({ event: 'pre_tool_use', handler: async () => { callOrder.push('first'); return { action: 'continue' }; }, priority: 1 });
    hm.register({ event: 'pre_tool_use', handler: async () => { callOrder.push('second'); return { action: 'continue' }; }, priority: 10 });

    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'continue' });
    expect(callOrder).toEqual(['first', 'second']);
  });

  it('approve proceeds to the next hook', async () => {
    const hm = new HookManager();
    const callOrder: string[] = [];

    hm.register({ event: 'pre_tool_use', handler: async () => { callOrder.push('first'); return { action: 'approve' }; }, priority: 1 });
    hm.register({ event: 'pre_tool_use', handler: async () => { callOrder.push('second'); return { action: 'continue' }; }, priority: 10 });

    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'continue' });
    expect(callOrder).toEqual(['first', 'second']);
  });
});

// ============================================================
// trigger - no hooks
// ============================================================
describe('HookManager - trigger no hooks', () => {
  it('returns continue when no hooks are registered for the event', async () => {
    const hm = new HookManager();
    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'continue' });
  });

  it('returns continue for an event with no hooks while other events have hooks', async () => {
    const hm = new HookManager();
    hm.register({ event: 'pre_tool_use', handler: continueHook });
    const result = await hm.trigger('post_tool_use', makeContext({ event: 'post_tool_use' }));
    expect(result).toEqual({ action: 'continue' });
  });
});

// ============================================================
// trigger - error handling
// ============================================================
describe('HookManager - trigger error handling', () => {
  it('catches hook errors and continues execution', async () => {
    const hm = new HookManager();
    const callOrder: string[] = [];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    hm.register({
      event: 'pre_tool_use',
      handler: async () => { throw new Error('hook failed'); },
      priority: 1,
    });
    hm.register({
      event: 'pre_tool_use',
      handler: async () => { callOrder.push('after-error'); return { action: 'continue' }; },
      priority: 10,
    });

    const result = await hm.trigger('pre_tool_use', makeContext());
    expect(result).toEqual({ action: 'continue' });
    expect(callOrder).toEqual(['after-error']);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('logs hook ID when an error occurs', async () => {
    const hm = new HookManager();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    hm.register({
      event: 'pre_tool_use',
      handler: async () => { throw new Error('boom'); },
      id: 'failing-hook',
    });

    await hm.trigger('pre_tool_use', makeContext());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('failing-hook'),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});

// ============================================================
// unregister
// ============================================================
describe('HookManager - unregister', () => {
  it('removes a specific hook by ID', async () => {
    const hm = new HookManager();
    const spy = vi.fn();

    const id = hm.register({ event: 'pre_tool_use', handler: async () => { spy(); return { action: 'continue' }; } });
    const removed = hm.unregister('pre_tool_use', id);
    expect(removed).toBe(true);

    await hm.trigger('pre_tool_use', makeContext());
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns false if hook ID not found', () => {
    const hm = new HookManager();
    const removed = hm.unregister('pre_tool_use', 'nonexistent');
    expect(removed).toBe(false);
  });

  it('returns false if event has no hooks', () => {
    const hm = new HookManager();
    const removed = hm.unregister('pre_tool_use', 'some-id');
    expect(removed).toBe(false);
  });

  it('only removes the targeted hook, not others on same event', async () => {
    const hm = new HookManager();
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    const id1 = hm.register({ event: 'pre_tool_use', handler: async () => { spy1(); return { action: 'continue' }; } });
    hm.register({ event: 'pre_tool_use', handler: async () => { spy2(); return { action: 'continue' }; } });

    hm.unregister('pre_tool_use', id1);
    await hm.trigger('pre_tool_use', makeContext());

    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });
});

// ============================================================
// clear
// ============================================================
describe('HookManager - clear', () => {
  it('clears all hooks for a specific event', async () => {
    const hm = new HookManager();
    const spy = vi.fn();

    hm.register({ event: 'pre_tool_use', handler: async () => { spy(); return { action: 'continue' }; } });
    hm.register({ event: 'pre_tool_use', handler: continueHook });
    hm.register({ event: 'post_tool_use', handler: continueHook });

    hm.clear('pre_tool_use');

    await hm.trigger('pre_tool_use', makeContext());
    expect(spy).not.toHaveBeenCalled();
  });

  it('clears all hooks for all events when called without argument', async () => {
    const hm = new HookManager();
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    hm.register({ event: 'pre_tool_use', handler: async () => { spy1(); return { action: 'continue' }; } });
    hm.register({ event: 'post_tool_use', handler: async () => { spy2(); return { action: 'continue' }; } });

    hm.clear();

    await hm.trigger('pre_tool_use', makeContext());
    await hm.trigger('post_tool_use', makeContext({ event: 'post_tool_use' }));
    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).not.toHaveBeenCalled();
  });

  it('does not affect other events when clearing a specific event', async () => {
    const hm = new HookManager();
    const spy = vi.fn();

    hm.register({ event: 'pre_tool_use', handler: continueHook });
    hm.register({ event: 'post_tool_use', handler: async () => { spy(); return { action: 'continue' }; } });

    hm.clear('pre_tool_use');

    await hm.trigger('post_tool_use', makeContext({ event: 'post_tool_use' }));
    expect(spy).toHaveBeenCalled();
  });

  it('can register new hooks after clearing', async () => {
    const hm = new HookManager();

    hm.register({ event: 'pre_tool_use', handler: continueHook });
    hm.clear('pre_tool_use');

    const spy = vi.fn();
    hm.register({ event: 'pre_tool_use', handler: async () => { spy(); return { action: 'continue' }; } });

    await hm.trigger('pre_tool_use', makeContext());
    expect(spy).toHaveBeenCalled();
  });
});

// ============================================================
// trigger - context passing
// ============================================================
describe('HookManager - trigger context passing', () => {
  it('passes context with event field to handlers', async () => {
    const hm = new HookManager();
    let receivedEvent: HookEvent | undefined;

    hm.register({
      event: 'session_start',
      handler: async (ctx) => { receivedEvent = ctx.event; return { action: 'continue' }; },
    });

    await hm.trigger('session_start', makeContext({ event: 'session_start' }));
    expect(receivedEvent).toBe('session_start');
  });

  it('passes custom context fields to handlers', async () => {
    const hm = new HookManager();
    let receivedData: unknown;

    hm.register({
      event: 'pre_tool_use',
      handler: async (ctx) => { receivedData = ctx.customField; return { action: 'continue' }; },
    });

    await hm.trigger('pre_tool_use', makeContext({ customField: 'test-value' } as any));
    expect(receivedData).toBe('test-value');
  });
});

// ============================================================
// trigger - all HookEvents
// ============================================================
describe('HookManager - all HookEvents', () => {
  const events: HookEvent[] = [
    'pre_tool_use',
    'post_tool_use',
    'permission_request',
    'session_start',
    'session_end',
    'context_compact',
    'message_sent',
    'message_received',
  ];

  it.each(events)('supports event "%s"', async (event) => {
    const hm = new HookManager();
    let received: HookEvent | undefined;

    hm.register({
      event,
      handler: async (ctx) => { received = ctx.event; return { action: 'continue' }; },
    });

    await hm.trigger(event, makeContext({ event }));
    expect(received).toBe(event);
  });
});
