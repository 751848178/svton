import type {
  CommandExecutionTimelineItem,
  TimelineAction,
  TimelineItem,
  TimelineStatus,
  TimelineTurn,
} from './types';
import { appendBoundedProgress, boundTimelineItems } from './bounds';
import { settleApproval } from './approval.reducer';
import {
  aggregateFileOutcomeItems,
  finishFileOutcomeItems,
  settleFileOutcomesAtTurnEnd,
} from './file-outcome.reducer';
import { applyUsageContributions } from './usage-snapshot';

const TERMINAL = new Set<TimelineStatus>([
  'completed', 'failed', 'declined', 'cancelled', 'interrupted',
]);

export function isTerminalTimelineStatus(status: TimelineStatus): boolean {
  return TERMINAL.has(status);
}

export function reduceTimeline(
  current: TimelineTurn | undefined,
  action: TimelineAction,
): TimelineTurn {
  const state = current ?? createTurn(action);
  if (state.sessionId !== action.sessionId || state.turnId !== action.turnId) return state;
  if (!isAllowedForTurn(state.status, action.type)) return state;

  switch (action.type) {
    case 'start':
      if (state.status !== 'running' || state.items.some((item) => item.id === action.item.id)) return state;
      return revise(state, [...state.items, action.item]);
    case 'requestApproval':
      if (state.items.some((item) => item.id === action.item.id)) return state;
      return revise(state, [...state.items, action.item]);
    case 'settleApproval':
      return settleApproval(state, action);
    case 'update':
      return updateProgress(state, action.id, action.progress);
    case 'finish':
      return finishItem(state, action);
    case 'addOutcome':
      return addOutcome(state, action.item);
    case 'captureUsage':
      return applyUsageContributions(state, action.contributions, action.fallbackOnly);
    case 'finishFileOutcome': {
      const items = finishFileOutcomeItems(state.items, action);
      return items ? revise(state, items) : state;
    }
    case 'completeTurn':
      return finishTurn(state, 'completed', action.at, action.durationMs);
    case 'failTurn': {
      const withError = addOutcome(state, action.item);
      return finishTurn(withError, 'failed', action.at, action.durationMs);
    }
    case 'interruptTurn':
      return interruptTurn(state, action.at);
  }
}

function isAllowedForTurn(
  status: TimelineTurn['status'],
  _action: TimelineAction['type'],
): boolean {
  return status === 'running';
}

function createTurn(action: TimelineAction): TimelineTurn {
  return {
    version: 1,
    sessionId: action.sessionId,
    turnId: action.turnId,
    status: 'running',
    startedAt: action.at,
    items: [],
    revision: 0,
  };
}

function revise(state: TimelineTurn, items: TimelineItem[]): TimelineTurn {
  return { ...state, items: boundTimelineItems(items), revision: state.revision + 1 };
}

function updateProgress(
  state: TimelineTurn,
  id: string,
  progress: { id: string; text: string; createdAt: number },
): TimelineTurn {
  const target = state.items.find((item) => item.id === id);
  if (!target || isTerminalTimelineStatus(target.status) || !('progress' in target)) return state;
  if (target.progress.some((entry) => entry.id === progress.id)) return state;
  const items = state.items.map((item) => item.id === id && 'progress' in item
    ? { ...item, progress: appendBoundedProgress(item.progress, progress), revision: item.revision + 1 }
    : item);
  return revise(state, items);
}

function finishItem(
  state: TimelineTurn,
  action: Extract<TimelineAction, { type: 'finish' }>,
): TimelineTurn {
  const target = state.items.find((item) => item.id === action.id);
  if (!target || isTerminalTimelineStatus(target.status)) return state;
  const items = state.items.map((item): TimelineItem => {
    if (item.id !== action.id) return item;
    const common = {
      ...item,
      lane: 'outcome' as const,
      status: action.status,
      title: action.title,
      summary: action.summary,
      completedAt: action.at,
      result: action.result,
      ...(action.retry ? { retry: action.retry } : {}),
      revision: item.revision + 1,
    };
    if (item.kind !== 'commandExecution') return common;
    return { ...common, ...action.command } as CommandExecutionTimelineItem;
  });
  return revise(state, items);
}

function addOutcome(state: TimelineTurn, item: TimelineItem): TimelineTurn {
  if (state.items.some((existing) => existing.id === item.id)) return state;
  return revise(state, [...state.items, item]);
}

function finishTurn(
  state: TimelineTurn,
  status: 'completed' | 'failed',
  completedAt: number,
  durationMs?: number,
): TimelineTurn {
  if (state.status !== 'running') return state;
  const settled = settleFileOutcomesAtTurnEnd(state.items, completedAt);
  const items = aggregateFileOutcomeItems(settled, state.turnId);
  return { ...state, items, status, completedAt, durationMs, revision: state.revision + 1 };
}

function interruptTurn(state: TimelineTurn, completedAt: number): TimelineTurn {
  if (state.status !== 'running') return state;
  const settledFiles = settleFileOutcomesAtTurnEnd(state.items, completedAt);
  const interruptedItems = settledFiles.map((item): TimelineItem => isTerminalTimelineStatus(item.status)
    ? item
    : {
        ...item,
        lane: 'outcome',
        status: 'interrupted',
        title: `${item.title} interrupted`,
        ...(item.kind === 'approvalDecision' ? { decision: 'interrupted' as const } : {}),
        completedAt,
        revision: item.revision + 1,
      });
  const items = aggregateFileOutcomeItems(boundTimelineItems(interruptedItems), state.turnId);
  return {
    ...state,
    items,
    status: 'interrupted',
    completedAt,
    revision: state.revision + 1,
  };
}
