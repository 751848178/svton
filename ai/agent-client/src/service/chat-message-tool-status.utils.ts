import type { ContentBlock, DisplayMessage, DisplayToolCall } from '../types';

export function finalizeStalePendingApprovals(messages: DisplayMessage[]): DisplayMessage[] {
  return messages.map(finalizeMessagePendingApprovals);
}

export function updateToolCallStatusInMessages(
  messages: DisplayMessage[],
  callId: string,
  status: DisplayToolCall['status'],
  metadata?: Record<string, unknown>,
): DisplayMessage[] {
  return messages.map((message) => updateMessageToolCallStatus(message, callId, status, metadata));
}

function finalizeMessagePendingApprovals(message: DisplayMessage): DisplayMessage {
  const toolCalls = message.toolCalls?.map(finalizeToolCall);
  const blocks = message.blocks?.map(finalizeToolCallBlock);

  return {
    ...message,
    ...(toolCalls ? { toolCalls } : {}),
    ...(blocks ? { blocks } : {}),
  };
}

function updateMessageToolCallStatus(
  message: DisplayMessage,
  callId: string,
  status: DisplayToolCall['status'],
  metadata?: Record<string, unknown>,
): DisplayMessage {
  const updates = metadata ? { status, metadata } : { status };
  const toolCalls = message.toolCalls?.map((toolCall) =>
    toolCall.id === callId ? { ...toolCall, ...updates } : toolCall,
  );
  const blocks = message.blocks?.map((block) =>
    block.type === 'tool_call' && block.call.id === callId
      ? { ...block, call: { ...block.call, ...updates } }
      : block.type === 'subagent' && block.agentId === callId
        ? { ...block, status: toSubagentBlockStatus(status) }
      : block,
  );

  return {
    ...message,
    ...(toolCalls ? { toolCalls } : {}),
    ...(blocks ? { blocks } : {}),
  };
}

function finalizeToolCall(toolCall: DisplayToolCall): DisplayToolCall {
  if (toolCall.status !== 'pending_approval') return toolCall;
  return { ...toolCall, status: 'error' };
}

function finalizeToolCallBlock(block: ContentBlock): ContentBlock {
  if (block.type === 'tool_call' && block.call.status === 'pending_approval') {
    return {
      ...block,
      call: finalizeToolCall(block.call),
    };
  }
  if (block.type === 'subagent' && block.status === 'pending') {
    return { ...block, status: 'error' };
  }
  return block;
}

function toSubagentBlockStatus(status: DisplayToolCall['status']) {
  if (status === 'pending_approval') return 'pending' as const;
  return status;
}
