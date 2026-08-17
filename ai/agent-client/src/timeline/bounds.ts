import { redactSecrets } from '@svton/agent-core';
import type { TimelineProgressEntry } from './types';

export const MAX_TIMELINE_ITEMS = 200;
export const MAX_TIMELINE_TEXT = 65_536;
export const MAX_PROGRESS_ENTRIES = 50;
export const MAX_PROGRESS_TEXT = 4_096;

export function boundTimelineText(value: string, max = MAX_TIMELINE_TEXT): string {
  const safe = redactSecrets(value);
  return safe.length <= max ? safe : `${safe.slice(0, max - 14)}\n[truncated]`;
}

export function boundProgressText(value: string): string {
  return boundTimelineText(value, MAX_PROGRESS_TEXT);
}

export function appendBoundedProgress(
  entries: TimelineProgressEntry[],
  entry: TimelineProgressEntry,
): TimelineProgressEntry[] {
  return [...entries, { ...entry, text: boundProgressText(entry.text) }]
    .slice(-MAX_PROGRESS_ENTRIES);
}

export function boundTimelineItems<T>(items: T[]): T[] {
  return items.slice(-MAX_TIMELINE_ITEMS);
}
