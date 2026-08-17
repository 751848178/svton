import { reduceTimeline } from './lifecycle.reducer';
import type { TimelineItem, TimelineStatus, TimelineTurn } from './types';
import { parseTimelineTurn } from './deserialization-validator';
import { boundTimelineItems } from './bounds';

export interface TimelineReloadOptions {
  live?: boolean;
  now?: number;
}

export function serializeTimeline(timeline: TimelineTurn | undefined): unknown {
  if (!timeline) return undefined;
  const sanitized = parseTimelineTurn({
    ...timeline,
    items: boundTimelineItems(timeline.items),
  });
  return sanitized ? JSON.parse(JSON.stringify(sanitized)) as TimelineTurn : undefined;
}

export function deserializeTimeline(
  value: unknown,
  options: TimelineReloadOptions = {},
): TimelineTurn | undefined {
  const cloned = parseTimelineTurn(value);
  if (!cloned) return undefined;
  if (options.live) return cloned;
  return makeReloadedStateNonActionable(cloned, options.now ?? Date.now());
}

function makeReloadedStateNonActionable(
  timeline: TimelineTurn,
  now: number,
): TimelineTurn {
  if (timeline.status === 'running') {
    return reduceTimeline(timeline, {
      type: 'interruptTurn',
      sessionId: timeline.sessionId,
      turnId: timeline.turnId,
      at: now,
    });
  }
  let changed = false;
  const items = timeline.items.map((item): TimelineItem => {
    if (isTerminal(item.status)) return item;
    changed = true;
    return {
      ...item,
      lane: 'outcome',
      status: 'interrupted',
      title: `${item.title} interrupted`,
      ...(item.kind === 'approvalDecision' ? { decision: 'interrupted' as const } : {}),
      completedAt: now,
      revision: item.revision + 1,
    };
  });
  return changed ? { ...timeline, items, revision: timeline.revision + 1 } : timeline;
}

function isTerminal(status: TimelineStatus): boolean {
  return !['pending', 'running', 'awaitingApproval'].includes(status);
}
