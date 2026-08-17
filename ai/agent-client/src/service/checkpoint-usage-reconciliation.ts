import type { DisplayMessage } from '../types';
import type { TimelineTurn } from '../timeline/types';
import { mergeUsageStates } from '../timeline/usage-snapshot';

/** Coalesces Pi per-response usage onto the last assistant message of each logical user turn. */
export function reconcileCheckpointUsage(messages: DisplayMessage[]): DisplayMessage[] {
  let result = messages;
  let assistants: number[] = [];
  const flush = () => {
    if (assistants.length === 0) return;
    result = reconcileAssistantGroup(result, assistants);
    assistants = [];
  };
  messages.forEach((message, index) => {
    if (message.role === 'user') flush();
    if (message.role === 'assistant') assistants.push(index);
  });
  flush();
  return result;
}

function reconcileAssistantGroup(
  messages: DisplayMessage[],
  assistantIndexes: number[],
): DisplayMessage[] {
  const sources = assistantIndexes.flatMap((index) => {
    const timeline = messages[index]?.timeline;
    return timeline?.usage ? [timeline] : [];
  });
  if (sources.length <= 1) return messages;
  const merged = mergeUsageStates(sources);
  if (!merged) return messages;
  const targetIndex = assistantIndexes.at(-1);
  if (targetIndex === undefined) return messages;
  return messages.map((message, index) => {
    if (!assistantIndexes.includes(index) || !message.timeline?.usage) return message;
    if (index === targetIndex) return {
      ...message,
      timeline: { ...message.timeline, ...merged, revision: message.timeline.revision + 1 },
    };
    return { ...message, timeline: removeUsage(message.timeline) };
  });
}

function removeUsage(timeline: TimelineTurn): TimelineTurn | undefined {
  const {
    usage: _usage,
    usageResponseKeys: _keys,
    ...rest
  } = timeline;
  return timeline.items.length > 0
    ? { ...rest, revision: timeline.revision + 1 }
    : undefined;
}
