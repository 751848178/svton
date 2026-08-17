import type { DisplayMessage } from '../types';
import type { TimelineTurn } from '../timeline/types';
import {
  executionItemIds,
  findExecutionMatch,
  indexedRole,
  matchLogicalUsers,
  precedingUserIndex,
  type IndexedMessage,
} from './timeline-restore-matching';

/** Merge checkpoint-owned display projection with safe persisted timeline-only state. */
export function mergePersistedTimeline(
  projected: DisplayMessage[],
  persisted: DisplayMessage[],
): DisplayMessage[] {
  const projectedAssistants = indexedRole(projected, 'assistant');
  const userMatches = matchLogicalUsers(projected, persisted);
  const replacements = new Map<number, DisplayMessage>();
  const suppressedExecutions = new Map<number, Set<string>>();

  persisted.forEach((saved, savedIndex) => {
    if (saved.role !== 'assistant' || !saved.timeline) return;
    const executionIds = executionItemIds(saved.timeline);
    const execution = executionIds.length > 0
      ? findExecutionMatch(executionIds, projectedAssistants)
      : undefined;
    if (executionIds.length > 0 && !execution) return;
    const logicalUserMatched = hasLogicalUserMatch(savedIndex, persisted, userMatches);
    const logicalTurnTarget = logicalUserMatched
      ? findDiagnosticTarget(savedIndex, projected, persisted, userMatches)
      : undefined;
    const usageTarget = saved.timeline.usage || logicalTurnTarget?.message.timeline?.usage
      ? logicalTurnTarget
      : undefined;
    const target = usageTarget ?? execution?.target ?? (executionIds.length === 0
      ? findDiagnosticTarget(savedIndex, projected, persisted, userMatches)
      : undefined);
    if (!target || replacements.has(target.index)) return;
    for (const [index, ids] of execution?.matchedIds ?? []) {
      const suppressed = suppressedExecutions.get(index) ?? new Set<string>();
      ids.forEach((id) => suppressed.add(id));
      suppressedExecutions.set(index, suppressed);
    }
    const filteredTimeline = execution
      ? filterExecutionOverlay(saved.timeline!, execution.matchedExecutionIds, logicalUserMatched)
      : saved.timeline;
    replacements.set(target.index, {
      ...target.message,
      id: saved.id,
      timeline: preserveCheckpointUsage(filteredTimeline, target.message.timeline),
      duration: saved.duration ?? target.message.duration,
    });
  });

  const savedUserByProjectedIndex = new Map<number, DisplayMessage>();
  for (const [savedIndex, projectedIndex] of userMatches) {
    savedUserByProjectedIndex.set(projectedIndex, persisted[savedIndex]);
  }
  return projected.map((message, index) => {
    const replacement = replacements.get(index);
    if (replacement) return suppressExecutions(
      replacement, suppressedExecutions.get(index), true,
    );
    const savedUser = savedUserByProjectedIndex.get(index);
    const restored = savedUser ? { ...message, id: savedUser.id } : message;
    return suppressExecutions(restored, suppressedExecutions.get(index));
  });
}

function preserveCheckpointUsage(
  saved: TimelineTurn,
  checkpoint: TimelineTurn | undefined,
): TimelineTurn {
  if (saved.usage || !checkpoint?.usage) return saved;
  return {
    ...saved,
    usage: checkpoint.usage,
    usageResponseKeys: checkpoint.usageResponseKeys,
  };
}

function filterExecutionOverlay(
  timeline: TimelineTurn,
  matchedIds: Set<string>,
  keepDiagnostics: boolean,
): TimelineTurn {
  return {
    ...timeline,
    items: timeline.items.filter((item) => (
      item.kind === 'toolExecution' || item.kind === 'commandExecution'
        ? matchedIds.has(item.id)
        : item.kind === 'fileOutcome'
          ? item.sourceCallIds.every((id) => matchedIds.has(id))
        : keepDiagnostics
    )),
  };
}

function hasLogicalUserMatch(
  savedAssistantIndex: number,
  persisted: DisplayMessage[],
  userMatches: Map<number, number>,
): boolean {
  const userIndex = precedingUserIndex(persisted, savedAssistantIndex);
  return userIndex !== undefined && userMatches.has(userIndex);
}

function suppressExecutions(
  message: DisplayMessage,
  ids: Set<string> | undefined,
  preserveTimeline = false,
): DisplayMessage {
  if (!ids || message.role !== 'assistant') return message;
  const toolCalls = message.toolCalls?.filter((call) => !ids.has(call.id));
  const blocks = message.blocks?.filter((block) => (
    block.type !== 'tool_call' || !ids.has(block.call.id)
  ));
  const items = preserveTimeline
    ? message.timeline?.items
    : message.timeline?.items.filter((item) => {
      if (item.kind === 'toolExecution' || item.kind === 'commandExecution') {
        return !ids.has(item.id);
      }
      if (item.kind === 'fileOutcome') {
        return !item.sourceCallIds.every((id) => ids.has(id));
      }
      return true;
    });
  return {
    ...message,
    toolCalls: toolCalls?.length ? toolCalls : undefined,
    blocks: blocks?.length ? blocks : undefined,
    timeline: items?.length ? { ...message.timeline!, items } : undefined,
  };
}

function findDiagnosticTarget(
  savedAssistantIndex: number,
  projected: DisplayMessage[],
  persisted: DisplayMessage[],
  userMatches: Map<number, number>,
): IndexedMessage | undefined {
  const savedUserIndex = precedingUserIndex(persisted, savedAssistantIndex);
  const projectedUserIndex = savedUserIndex === undefined
    ? undefined
    : userMatches.get(savedUserIndex);
  if (projectedUserIndex === undefined) return undefined;
  const nextUser = projected.findIndex((message, index) => (
    index > projectedUserIndex && message.role === 'user'
  ));
  const end = nextUser < 0 ? projected.length : nextUser;
  for (let index = end - 1; index > projectedUserIndex; index -= 1) {
    if (projected[index].role === 'assistant') return { index, message: projected[index] };
  }
  return undefined;
}
