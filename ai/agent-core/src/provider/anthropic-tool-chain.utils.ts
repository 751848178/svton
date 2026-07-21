interface AnthropicToolBlockLike {
  type: string;
  id?: string;
  tool_use_id?: string;
}

interface AnthropicMessageLike {
  content: string | AnthropicToolBlockLike[];
}

export function sanitizeAnthropicToolUseChain(messages: AnthropicMessageLike[]): void {
  const toolUseIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === 'tool_use' && block.id) toolUseIds.add(block.id);
      if (block.type === 'tool_result' && block.tool_use_id) toolResultIds.add(block.tool_use_id);
    }
  }

  stripOrphanedToolResults(messages, toolUseIds, toolResultIds);
  stripOrphanedToolUses(messages, toolUseIds, toolResultIds);
  dropEmptyMessages(messages);
}

function stripOrphanedToolResults(
  messages: AnthropicMessageLike[],
  toolUseIds: Set<string>,
  toolResultIds: Set<string>,
): void {
  const orphanedResults = new Set([...toolResultIds].filter((id) => !toolUseIds.has(id)));
  if (orphanedResults.size === 0) return;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    msg.content = msg.content.filter((block) =>
      block.type !== 'tool_result' || !orphanedResults.has(block.tool_use_id ?? ''),
    );
  }

  for (const id of orphanedResults) toolResultIds.delete(id);
}

function stripOrphanedToolUses(
  messages: AnthropicMessageLike[],
  toolUseIds: Set<string>,
  toolResultIds: Set<string>,
): void {
  if (toolResultIds.size >= toolUseIds.size) return;

  const orphaned = new Set([...toolUseIds].filter((id) => !toolResultIds.has(id)));
  if (orphaned.size === 0) return;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    msg.content = msg.content.filter((block) =>
      block.type !== 'tool_use' || !orphaned.has(block.id ?? ''),
    );
  }
}

function dropEmptyMessages(messages: AnthropicMessageLike[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content;
    if (Array.isArray(content) && content.length === 0) {
      messages.splice(i, 1);
    }
  }
}
