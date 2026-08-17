import { describe, expect, it, vi } from 'vitest';
import type { ToolApprovalRequest } from '@svton/agent-core';
import { ApprovalQueue } from '../src/service/chat-approval-queue';

function request(
  sessionId: string,
  requestId: string,
  createdAt: number,
): ToolApprovalRequest {
  return {
    sessionId,
    requestId,
    itemId: `item-${requestId}`,
    createdAt,
    toolName: 'shell',
    arguments: { command: 'pwd' },
    decisions: ['accept', 'acceptForSession', 'decline', 'cancel'],
  };
}

describe('ApprovalQueue', () => {
  it('orders reverse-arrival requests by createdAt then requestId per session', () => {
    const queue = new ApprovalQueue();
    queue.enqueue(request('a', 'later', 20), () => true);
    queue.enqueue(request('a', 'same-z', 10), () => true);
    queue.enqueue(request('a', 'same-a', 10), () => true);
    queue.enqueue(request('b', 'b-only', 1), () => true);

    expect(queue.head('a')?.requestId).toBe('same-a');
    expect(queue.head('b')?.requestId).toBe('b-only');
  });

  it('deletes before invoking the captured binding and settles only once', () => {
    const queue = new ApprovalQueue();
    const settle = vi.fn(() => {
      expect(queue.head('a')).toBeNull();
      return true;
    });
    queue.enqueue(request('a', 'a1', 1), settle);

    expect(queue.settle('a', 'a1', 'accept')).toBe(true);
    expect(queue.settle('a', 'a1', 'accept')).toBe(false);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('terminalizes a rejected binding and cannot ghost-reenqueue it', () => {
    const rejected = vi.fn();
    const approval = request('a', 'a1', 1);
    const queue = new ApprovalQueue(() => {}, rejected);
    queue.enqueue(approval, () => false);

    expect(queue.settle('a', 'a1', 'decline')).toBe(false);
    expect(queue.head('a')).toBeNull();
    expect(rejected).toHaveBeenCalledWith(approval);
    expect(queue.enqueue(approval, () => true)).toBe(false);
  });

  it('canonicalizes selectors and redacts legacy adapter secrets', () => {
    const queue = new ApprovalQueue();
    queue.set('legacy', {
      sessionId: '  a  ',
      call: {
        id: 'legacy',
        name: 'deploy',
        arguments: {
          apiKey: 'raw-api-key', nested: { password: 'raw-password' },
          bigint: 42n, missing: undefined, callback: () => true,
        },
      },
      metadata: { auth: 'token=raw-token', safeId: 'task-1', tokenCount: 3 },
      resolve: () => {},
    });

    expect(queue.head('a')?.requestId).toBe('legacy:legacy');
    const serialized = JSON.stringify(queue.toDisplay('a'));
    expect(serialized).not.toContain('raw-api-key');
    expect(serialized).not.toContain('raw-password');
    expect(serialized).not.toContain('raw-token');
    expect(queue.head('a')?.metadata).toMatchObject({ safeId: 'task-1', tokenCount: 3 });
    expect(queue.head('a')?.arguments).toMatchObject({
      bigint: '42', missing: null, callback: null,
    });
  });

  it('terminalizes cyclic legacy arguments and metadata without throwing', () => {
    const argumentsValue: Record<string, unknown> = { password: 'raw-password' };
    const metadata: Record<string, unknown> = { auth: 'token=raw-token' };
    argumentsValue.self = argumentsValue;
    metadata.self = metadata;
    const queue = new ApprovalQueue();

    expect(() => queue.set('cyclic', {
      call: { id: 'cyclic', arguments: argumentsValue },
      metadata,
      resolve: () => {},
    })).not.toThrow();
    const serialized = JSON.stringify(queue.toDisplay(null));
    expect(serialized).not.toContain('raw-password');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).toContain('[circular]');
  });
});
