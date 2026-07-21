interface OpenAIToolCallLike {
  id: string;
}

interface OpenAIChatMessageLike {
  role: string;
  content: string | unknown[] | null;
  tool_calls?: OpenAIToolCallLike[];
  tool_call_id?: string;
}

export function sanitizeOpenAIToolUseChain(messages: OpenAIChatMessageLike[]): void {
  const toolCallIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (const msg of messages) {
    for (const tc of msg.tool_calls ?? []) toolCallIds.add(tc.id);
    if (msg.tool_call_id) toolResultIds.add(msg.tool_call_id);
  }

  stripOrphanedToolResults(messages, toolCallIds, toolResultIds);
  stripOrphanedToolCalls(messages, toolCallIds, toolResultIds);
}

function stripOrphanedToolResults(
  messages: OpenAIChatMessageLike[],
  toolCallIds: Set<string>,
  toolResultIds: Set<string>,
): void {
  const orphanedResults = new Set([...toolResultIds].filter((id) => !toolCallIds.has(id)));
  if (orphanedResults.size === 0) return;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'tool' && msg.tool_call_id && orphanedResults.has(msg.tool_call_id)) {
      messages.splice(i, 1);
    }
  }

  for (const id of orphanedResults) toolResultIds.delete(id);
}

function stripOrphanedToolCalls(
  messages: OpenAIChatMessageLike[],
  toolCallIds: Set<string>,
  toolResultIds: Set<string>,
): void {
  if (toolResultIds.size >= toolCallIds.size) return;

  const orphaned = new Set([...toolCallIds].filter((id) => !toolResultIds.has(id)));
  if (orphaned.size === 0) return;

  for (const msg of messages) {
    if (!msg.tool_calls) continue;
    const remaining = msg.tool_calls.filter((tc) => !orphaned.has(tc.id));
    if (remaining.length === msg.tool_calls.length) continue;
    if (remaining.length > 0) {
      msg.tool_calls = remaining;
    } else {
      delete msg.tool_calls;
      if (msg.content === null) msg.content = '';
    }
  }
}
