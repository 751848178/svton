import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { ToolApprovalRequest } from '@svton/agent-core';
import { ChatApprovalController } from '../src/service/chat-approval-controller';
import { ChatService } from '../src/service/chat.service';
import type { MessageStoreHost } from '../src/service/chat-message-store';

function request(sessionId: string, requestId: string): ToolApprovalRequest {
  return {
    sessionId, requestId, itemId: `item-${requestId}`, createdAt: 1,
    toolName: 'shell', arguments: {}, decisions: ['accept', 'decline', 'cancel'],
  };
}

function host(activeSessionId: string | null): MessageStoreHost {
  return {
    messages: [], sessionMessages: new Map(), status: 'idle', lastUsage: null,
    activePlan: null, activeSessionId, backgroundSessionId: activeSessionId,
  };
}

describe('ChatApprovalController', () => {
  it('captures the exact runtime at enqueue instead of resolving against a later runtime', () => {
    const runtimeA = { settleToolApproval: vi.fn(() => true) };
    const runtimeB = { settleToolApproval: vi.fn(() => true) };
    let currentRuntime = runtimeA;
    const state = host('a');
    const controller = new ChatApprovalController(
      state, () => currentRuntime, () => {},
    );
    const approval = request('a', 'a1');
    controller.queue.enqueue(approval, controller.captureSettlement(approval));
    currentRuntime = runtimeB;

    expect(controller.settleRequest('a1', 'accept')).toBe(true);
    expect(runtimeA.settleToolApproval).toHaveBeenCalledWith('a', 'a1', 'accept');
    expect(runtimeB.settleToolApproval).not.toHaveBeenCalled();
  });

  it('does not own or mutate compatibility status when its queue changes', () => {
    const state = host('b');
    state.status = 'error';
    const controller = new ChatApprovalController(
      state, () => ({ settleToolApproval: () => true }), () => {},
    );
    const approval = request('a', 'a1');
    controller.queue.enqueue(approval, controller.captureSettlement(approval));
    expect(state.status).toBe('error');

    state.activeSessionId = 'a';
    expect(state.status).toBe('error');
  });

  it('turns a rejected settlement binding into interrupted history', () => {
    const state = host('a');
    const approval = request('a', 'a1');
    state.messages = [{
      id: 'turn-a', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
      timeline: {
        version: 1, sessionId: 'a', turnId: 'turn-a', status: 'running', revision: 1,
        items: [{
          id: 'a1', requestId: 'a1', itemId: approval.itemId, sessionId: 'a',
          turnId: 'turn-a', kind: 'approvalDecision', lane: 'decision',
          status: 'awaitingApproval', title: 'Approval requested', revision: 0,
          toolName: 'shell', arguments: {}, decisions: approval.decisions,
        }],
      },
    }];
    const controller = new ChatApprovalController(
      state, () => ({ settleToolApproval: () => false }), () => {},
    );
    controller.queue.enqueue(approval, controller.captureSettlement(approval));

    expect(controller.settleRequest('a1', 'decline')).toBe(false);
    expect(controller.queue.head('a')).toBeNull();
    expect(state.messages[0].timeline?.items[0]).toMatchObject({
      status: 'interrupted', decision: 'interrupted',
    });
  });
});

describe('ChatService approval event ownership', () => {
  it('keeps null-session core default requests attached to their typed timeline', () => {
    const service = new ChatService();
    service.messages = [{
      id: 'turn-default', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
    }];
    service.handleEvent({
      type: 'tool_approval_needed', request: request('default', 'default-1'),
    }, 'turn-default');
    expect(service.getPendingApproval()?.sessionId).toBe('default');
    expect(service.messages[0].timeline).toMatchObject({
      sessionId: 'default', items: [{ requestId: 'default-1' }],
    });
  });

  it('ignores a late approval event after its owning turn is terminal', () => {
    const service = new ChatService();
    const late = request('default', 'late-1');
    service.messages = [{
      id: 'turn-terminal', role: 'assistant', content: '', timestamp: 1,
      toolCalls: [{
        id: late.itemId, name: late.toolName, arguments: {}, status: 'completed',
      }],
      timeline: {
        version: 1, sessionId: 'default', turnId: 'turn-terminal',
        status: 'completed', revision: 1,
        items: [{
          id: 'done', sessionId: 'default', turnId: 'turn-terminal',
          kind: 'warning', lane: 'outcome', status: 'completed', title: 'Done',
          diagnostic: 'terminal', revision: 1,
        }],
      },
    }];

    service.handleEvent({ type: 'tool_approval_needed', request: late }, 'turn-terminal');

    expect(service.getPendingApproval()).toBeNull();
    expect(service.status).toBe('idle');
    expect(service.messages[0].toolCalls?.[0].status).toBe('completed');
    expect(service.messages[0].timeline?.items).toHaveLength(1);
  });

  it('projects background A approval lifecycle without changing selected B', () => {
    const service = new ChatService();
    const address = { sessionId: 'a', runId: 'run-a' };
    const approval = request('a', 'approval-a');
    service.bindSession('a');
    service.cacheSessionMessages('a', [{
      id: 'assistant-a', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
      toolCalls: [{
        id: approval.itemId, name: approval.toolName, arguments: {}, status: 'running',
      }],
    }]);
    (service as any).runs.start(address, 1);
    service.bindSession('b');
    service.messages = [];

    (service as any).handler.handle(
      { type: 'tool_approval_needed', request: approval },
      'assistant-a', service, address,
    );

    expect(service.status).toBe('idle');
    expect(service.isStreaming).toBe(false);
    expect(service.getPendingApproval()).toBeNull();
    expect(service.hasPendingApprovalsForSession('a')).toBe(true);
    expect(service.getSessionRunState('a')).toMatchObject({
      phase: 'waitingOnApproval', pendingApprovalIds: ['approval-a'],
    });

    (service as any).handler.handle({
      type: 'tool_approval_settled',
      settlement: {
        requestId: 'approval-a', sessionId: 'a', itemId: approval.itemId,
        decision: 'accept', settledAt: 2,
      },
    }, 'assistant-a', service, address);
    expect(service.status).toBe('idle');
    expect(service.getSessionRunState('a')).toMatchObject({
      phase: 'inProgress', pendingApprovalIds: [],
    });
  });
});
