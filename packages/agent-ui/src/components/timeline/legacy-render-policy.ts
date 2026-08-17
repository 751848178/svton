import type { ContentBlock } from '../chat/chat-message.types';
import type { ToolCallInfo } from '../chat/ToolCallCard';
import type { TimelineTurnView } from './timeline.types';

export function filterMigratedLegacyBlocks(
  blocks: ContentBlock[] | undefined,
  timeline: TimelineTurnView | undefined,
): ContentBlock[] | undefined {
  if (!blocks || !timeline) return blocks;
  const toolIds = new Set(timeline.items
    .flatMap((item) => item.kind === 'approvalDecision'
      ? [item.itemId]
      : item.kind === 'toolExecution' || item.kind === 'commandExecution' ? [item.id] : []));
  const hasWarning = timeline.items.some((item) => item.kind === 'warning');
  const hasError = timeline.items.some((item) => item.kind === 'error');
  const hasFileOutcome = timeline.items.some((item) => item.kind === 'fileOutcome');
  return blocks.filter((block) => {
    if (block.type === 'tool_call' && block.call && toolIds.has(block.call.id)) return false;
    if (block.type === 'warning' && hasWarning) return false;
    if (block.type === 'error' && hasError) return false;
    if ((block.type === 'file_change' || block.type === 'turn_diff') && hasFileOutcome) return false;
    return true;
  });
}

export function filterMigratedLegacyToolCalls(
  calls: ToolCallInfo[] | undefined,
  timeline: TimelineTurnView | undefined,
): ToolCallInfo[] | undefined {
  if (!calls || !timeline) return calls;
  const ids = new Set(timeline.items
    .flatMap((item) => item.kind === 'approvalDecision'
      ? [item.itemId]
      : item.kind === 'toolExecution' || item.kind === 'commandExecution' ? [item.id] : []));
  return calls.filter((call) => !ids.has(call.id));
}

export function filterMigratedLegacyError(
  error: string | undefined,
  timeline: TimelineTurnView | undefined,
): string | undefined {
  return timeline?.items.some((item) => item.kind === 'error') ? undefined : error;
}
