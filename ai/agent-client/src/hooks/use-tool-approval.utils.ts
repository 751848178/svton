import type { DisplayMessage, DisplayToolCall } from '../service/chat.service';

function pushPendingCall(
  calls: DisplayToolCall[],
  seenIds: Set<string>,
  call: DisplayToolCall | undefined,
): void {
  if (!call || call.status !== 'pending_approval' || seenIds.has(call.id)) {
    return;
  }
  seenIds.add(call.id);
  calls.push(call);
}

export function getVisiblePendingToolCalls(messages: DisplayMessage[]): DisplayToolCall[] {
  const calls: DisplayToolCall[] = [];
  const seenIds = new Set<string>();
  const blockCallIds = new Set<string>();

  for (const message of messages) {
    for (const block of message.blocks ?? []) {
      if (block.type === 'tool_call') {
        blockCallIds.add(block.call.id);
        pushPendingCall(calls, seenIds, block.call);
      }
    }
  }

  for (const message of messages) {
    for (const call of message.toolCalls ?? []) {
      if (!blockCallIds.has(call.id)) {
        pushPendingCall(calls, seenIds, call);
      }
    }
  }

  return calls;
}

export function hasVisiblePendingToolCalls(messages: DisplayMessage[]): boolean {
  return getVisiblePendingToolCalls(messages).length > 0;
}

export function mergeRuntimePendingToolCalls(
  visibleCalls: DisplayToolCall[],
  runtimeCalls: DisplayToolCall[],
): DisplayToolCall[] {
  const runtimeById = new Map(runtimeCalls.map((call) => [call.id, call]));
  const visibleIds = new Set<string>();
  const merged = visibleCalls.map((call) => {
    visibleIds.add(call.id);
    const runtimeCall = runtimeById.get(call.id);
    if (shouldPreferRuntimePendingCall(call, runtimeCall)) {
      return runtimeCall;
    }
    return call;
  });

  for (const call of runtimeCalls) {
    if (!visibleIds.has(call.id)) {
      merged.push(call);
    }
  }

  return merged;
}

function shouldPreferRuntimePendingCall(
  visibleCall: DisplayToolCall,
  runtimeCall: DisplayToolCall | undefined,
): runtimeCall is DisplayToolCall {
  return Boolean(
    runtimeCall
      && hasAutoReviewVerdict(runtimeCall.metadata)
      && !hasAutoReviewVerdict(visibleCall.metadata),
  );
}

function hasAutoReviewVerdict(metadata?: Record<string, unknown>): boolean {
  const value = metadata?.autoReviewVerdict;
  return Boolean(value && typeof value === 'object');
}
