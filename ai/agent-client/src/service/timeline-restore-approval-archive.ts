import type { DisplayMessage } from '../types';
import type { ApprovalDecisionTimelineItem } from '../timeline/types';
import { matchLogicalUsers, precedingUserIndex } from './timeline-restore-matching';

/** Append only terminal interrupted approval turns that are newer than canonical state. */
export function appendInterruptedApprovalArchive(
  canonicalDisplay: DisplayMessage[],
  persisted: DisplayMessage[],
): DisplayMessage[] {
  const userMatches = matchLogicalUsers(canonicalDisplay, persisted);
  const lastMatchedSavedUser = Math.max(-1, ...userMatches.keys());
  const lastCanonicalUser = lastUserIndex(canonicalDisplay);
  const existingRequests = approvalRequestIds(canonicalDisplay);
  const additions: DisplayMessage[] = [];
  const addedMessageIds = new Set<string>();

  persisted.forEach((message, index) => {
    const approvalItems = interruptedApprovalItems(message)
      .filter((item) => !existingRequests.has(item.requestId));
    if (approvalItems.length === 0) return;
    const savedUserIndex = precedingUserIndex(persisted, index);
    if (savedUserIndex === undefined) return;
    const canonicalUserIndex = userMatches.get(savedUserIndex);
    const isUnmatchedTail = canonicalUserIndex === undefined
      && savedUserIndex > lastMatchedSavedUser;
    const isMatchedTail = canonicalUserIndex === lastCanonicalUser
      && savedUserIndex === lastMatchedSavedUser;
    if (!isUnmatchedTail && !isMatchedTail) return;

    if (isUnmatchedTail) addOnce(additions, addedMessageIds, persisted[savedUserIndex]);
    addOnce(additions, addedMessageIds, archiveApprovalMessage(message, approvalItems));
    approvalItems.forEach((item) => existingRequests.add(item.requestId));
  });
  return additions.length > 0 ? [...canonicalDisplay, ...additions] : canonicalDisplay;
}

function interruptedApprovalItems(message: DisplayMessage): ApprovalDecisionTimelineItem[] {
  if (message.timeline?.status !== 'interrupted') return [];
  return message.timeline.items.filter((item): item is ApprovalDecisionTimelineItem => (
    item.kind === 'approvalDecision'
    && item.lane === 'outcome'
    && item.status === 'interrupted'
    && item.decision === 'interrupted'
  ));
}

function lastUserIndex(messages: DisplayMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index;
  }
  return -1;
}

function approvalRequestIds(messages: DisplayMessage[]): Set<string> {
  return new Set(messages.flatMap((message) => (
    message.timeline?.items.flatMap((item) => (
      item.kind === 'approvalDecision' ? [item.requestId] : []
    )) ?? []
  )));
}

function archiveApprovalMessage(
  message: DisplayMessage,
  items: ReturnType<typeof interruptedApprovalItems>,
): DisplayMessage {
  const { toolCalls: _toolCalls, blocks, isStreaming: _isStreaming, ...archive } = message;
  const safeBlocks = blocks?.filter((block) => block.type !== 'tool_call');
  return {
    ...archive,
    ...(safeBlocks?.length ? { blocks: safeBlocks } : {}),
    timeline: { ...message.timeline!, items },
  };
}

function addOnce(
  target: DisplayMessage[],
  ids: Set<string>,
  message: DisplayMessage,
): void {
  if (ids.has(message.id)) return;
  ids.add(message.id);
  target.push(message);
}
