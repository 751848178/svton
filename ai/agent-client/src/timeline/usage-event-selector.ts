import type { PublicRuntimeEvent } from '@svton/agent-core';
import { contributionFromAssistant } from './usage-snapshot';
import type { TimelineAction } from './types';

export function selectUsageActions(
  event: PublicRuntimeEvent,
  owner: { sessionId: string; turnId: string; at: number },
): TimelineAction[] {
  if (event.type === 'message_end' && event.message.role === 'assistant') {
    const contribution = contributionFromAssistant(event.message);
    return contribution ? [{
      ...owner, type: 'captureUsage', contributions: [contribution],
    }] : [];
  }
  if (event.type !== 'agent_end') return [];
  const contributions = event.messages.flatMap((message) => {
    if (message.role !== 'assistant') return [];
    const contribution = contributionFromAssistant(message);
    return contribution ? [contribution] : [];
  });
  return contributions.length > 0 ? [{
    ...owner, type: 'captureUsage', contributions, fallbackOnly: true,
  }] : [];
}
