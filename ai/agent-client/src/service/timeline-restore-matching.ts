import type { DisplayMessage } from '../types';
import type { TimelineTurn } from '../timeline/types';

export interface IndexedMessage {
  index: number;
  message: DisplayMessage;
}

export interface ExecutionMatch {
  target: IndexedMessage;
  matchedIds: Map<number, Set<string>>;
  matchedExecutionIds: Set<string>;
}

export function findExecutionMatch(
  executionIds: string[],
  assistants: IndexedMessage[],
): ExecutionMatch | undefined {
  const matchedIds = new Map<number, Set<string>>();
  const matchedExecutionIds = new Set<string>();
  for (const id of executionIds) {
    const matches = assistants.filter(({ message }) => (
      message.toolCalls?.some((call) => call.id === id)
    ));
    if (matches.length !== 1) continue;
    const match = matches[0];
    const ids = matchedIds.get(match.index) ?? new Set<string>();
    ids.add(id);
    matchedIds.set(match.index, ids);
    matchedExecutionIds.add(id);
  }
  for (let index = executionIds.length - 1; index >= 0; index -= 1) {
    const id = executionIds[index];
    if (!matchedExecutionIds.has(id)) continue;
    const target = assistants.find(({ index: assistantIndex }) => (
      matchedIds.get(assistantIndex)?.has(id)
    ));
    if (target) return { target, matchedIds, matchedExecutionIds };
  }
  return undefined;
}

export function executionItemIds(timeline: TimelineTurn): string[] {
  return [...new Set(timeline.items.flatMap((item) => {
    if (item.kind === 'toolExecution' || item.kind === 'commandExecution') return [item.id];
    if (item.kind === 'fileOutcome') return item.sourceCallIds;
    return [];
  }))];
}

export function matchLogicalUsers(
  projected: DisplayMessage[],
  persisted: DisplayMessage[],
): Map<number, number> {
  const projectedUsers = indexedRole(projected, 'user');
  const savedUsers = indexedRole(persisted, 'user');
  const matches = new Map<number, number>();
  let nextProjectedOrdinal = 0;
  savedUsers.forEach((saved, savedOrdinal) => {
    const candidates = projectedUsers.flatMap((entry, ordinal) => (
      ordinal >= nextProjectedOrdinal && sameUserPayload(entry.message, saved.message)
        ? [{ entry, ordinal }]
        : []
    ));
    const remainingDuplicates = savedUsers.slice(savedOrdinal)
      .filter((entry) => sameUserPayload(entry.message, saved.message)).length;
    const preferred = candidates.find((candidate) => (
      candidate.entry.message.timestamp === saved.message.timestamp
      && candidates.filter((item) => item.ordinal >= candidate.ordinal).length
        >= remainingDuplicates
    ));
    const target = preferred ?? candidates[0];
    if (!target) return;
    matches.set(saved.index, target.entry.index);
    nextProjectedOrdinal = target.ordinal + 1;
  });
  return matches;
}

export function precedingUserIndex(
  messages: DisplayMessage[],
  before: number,
): number | undefined {
  for (let index = before - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index;
  }
  return undefined;
}

export function indexedRole(
  messages: DisplayMessage[],
  role: DisplayMessage['role'],
): IndexedMessage[] {
  return messages.flatMap((message, index) => (
    message.role === role ? [{ index, message }] : []
  ));
}

function sameUserPayload(projected: DisplayMessage, persisted: DisplayMessage): boolean {
  return projected.content === persisted.content
    && sameImages(projected.images, persisted.images);
}

function sameImages(
  left: DisplayMessage['images'],
  right: DisplayMessage['images'],
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  return a.length === b.length && a.every((image, index) => (
    image.data === b[index]?.data
    && (image.mimeType ?? 'image/png') === (b[index]?.mimeType ?? 'image/png')
  ));
}
