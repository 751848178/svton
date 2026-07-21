import type { DisplayMessage, DisplayToolCall } from './types';
import { toSubagentBlockStatus } from './chat-event-message.utils';

export function getPendingToolCallsFromMessages(messages: DisplayMessage[]): DisplayToolCall[] {
  const calls: DisplayToolCall[] = [];
  const seen = new Set<string>();
  const blockCallIds = new Set<string>();

  const addPendingCall = (call: DisplayToolCall) => {
    if (call.status !== 'pending_approval' || seen.has(call.id)) {
      return;
    }
    seen.add(call.id);
    calls.push(call);
  };

  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.type === 'tool_call') {
        blockCallIds.add(block.call.id);
        addPendingCall(block.call);
      }
    }
  }

  for (const message of messages) {
    for (const call of message.toolCalls) {
      if (!blockCallIds.has(call.id)) {
        addPendingCall(call);
      }
    }
  }

  return calls;
}

export function hasPendingToolCallsInMessages(messages: DisplayMessage[]): boolean {
  return getPendingToolCallsFromMessages(messages).length > 0;
}

export function updateToolCallStatusInMessages(
  messages: DisplayMessage[],
  callId: string,
  status: DisplayToolCall['status'],
): DisplayMessage[] {
  return messages.map((message) => {
    let changed = false;

    const toolCalls = message.toolCalls.map((call) => {
      if (call.id !== callId) {
        return call;
      }
      changed = true;
      return { ...call, status };
    });

    const blocks = message.blocks.map((block) => {
      if (block.type === 'tool_call' && block.call.id === callId) {
        changed = true;
        return { ...block, call: { ...block.call, status } };
      }
      if (block.type === 'subagent' && block.agentId === callId) {
        changed = true;
        return { ...block, status: toSubagentBlockStatus(status) };
      }
      return block;
    });

    return changed ? { ...message, toolCalls, blocks } : message;
  });
}

export function finalizeAbortedMessages(messages: DisplayMessage[]): DisplayMessage[] {
  return messages.map((message) => {
    let changed = message.isStreaming === true;

    const toolCalls = message.toolCalls.map((call) => {
      if (call.status !== 'pending_approval') {
        return call;
      }
      changed = true;
      return { ...call, status: 'error' as const };
    });

    const blocks = message.blocks.map((block) => {
      if (block.type === 'tool_call' && block.call.status === 'pending_approval') {
        changed = true;
        return { ...block, call: { ...block.call, status: 'error' as const } };
      }
      if (block.type === 'subagent' && block.status === 'pending') {
        changed = true;
        return { ...block, status: 'error' as const };
      }
      return block;
    });

    return changed ? { ...message, toolCalls, blocks, isStreaming: false } : message;
  });
}
