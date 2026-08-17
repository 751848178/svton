import type { DisplayMessage } from '../types';
import { reduceTimeline } from './lifecycle.reducer';
import type { TimelineAction } from './types';

export function applyTimelineActions(
  message: DisplayMessage,
  actions: TimelineAction[],
): DisplayMessage {
  if (actions.length === 0) return message;
  const timeline = actions.reduce(reduceTimeline, message.timeline);
  return timeline === message.timeline ? message : { ...message, timeline };
}

export function interruptMessageTimeline(
  message: DisplayMessage,
  sessionId: string,
  at = Date.now(),
): DisplayMessage {
  if (!message.timeline || message.timeline.status !== 'running') return message;
  return applyTimelineActions(message, [{
    type: 'interruptTurn',
    sessionId,
    turnId: message.timeline.turnId,
    at,
  }]);
}

export function interruptApprovalInMessages(
  messages: DisplayMessage[],
  sessionId: string,
  requestId: string,
  at = Date.now(),
): DisplayMessage[] {
  return messages.map((message) => {
    const timeline = message.timeline;
    const ownsRequest = timeline?.sessionId === sessionId
      && timeline.items.some((item) =>
        item.kind === 'approvalDecision' && item.requestId === requestId);
    return ownsRequest ? applyTimelineActions(message, [{
      type: 'settleApproval',
      sessionId,
      turnId: timeline.turnId,
      requestId,
      decision: 'interrupted',
      at,
    }]) : message;
  });
}

export function finalizeMessageTimelineDuration(
  message: DisplayMessage,
  durationMs: number,
): DisplayMessage {
  if (!message.timeline || message.timeline.durationMs === durationMs) return message;
  return { ...message, timeline: { ...message.timeline, durationMs } };
}
