import { boundTimelineText } from './bounds';
import { boundFileChanges } from './file-outcome-bounds';
import { fileOutcomeTitle } from './file-outcome-normalizer';
import type {
  FileOutcomeTimelineItem,
  TimelineAction,
  TimelineItem,
  TimelineStatus,
  TimelineTerminalStatus,
} from './types';

const TERMINAL = new Set<TimelineStatus>([
  'completed', 'failed', 'declined', 'cancelled', 'interrupted',
]);
const STATUS_PRIORITY: Record<TimelineTerminalStatus, number> = {
  completed: 0,
  cancelled: 1,
  declined: 2,
  interrupted: 3,
  failed: 4,
};

export function finishFileOutcomeItems(
  items: TimelineItem[],
  action: Extract<TimelineAction, { type: 'finishFileOutcome' }>,
): TimelineItem[] | null {
  const target = items.find((item) => item.id === action.id);
  if (!target || target.kind !== 'fileOutcome' || TERMINAL.has(target.status)) return null;
  return items.map((item): TimelineItem => item.id !== action.id || item.kind !== 'fileOutcome'
    ? item
    : {
        ...item,
        status: action.status,
        title: action.title,
        detail: action.detail,
        changes: boundFileChanges(item.changes.map((change) => ({
          ...change,
          status: action.status,
          ...(action.diff ? { diff: action.diff } : {}),
        }))),
        completedAt: action.at,
        revision: item.revision + 1,
      });
}

export function settleFileOutcomesAtTurnEnd(
  items: TimelineItem[],
  completedAt: number,
): TimelineItem[] {
  return items.map((item): TimelineItem => item.kind !== 'fileOutcome' || TERMINAL.has(item.status)
    ? item
    : {
        ...item,
        status: 'interrupted',
        title: fileOutcomeTitle('interrupted'),
        changes: item.changes.map((change) => ({ ...change, status: 'interrupted' })),
        completedAt,
        revision: item.revision + 1,
      });
}

export function aggregateFileOutcomeItems(
  items: TimelineItem[],
  turnId: string,
): TimelineItem[] {
  const files = items.filter((item): item is FileOutcomeTimelineItem =>
    item.kind === 'fileOutcome' && item.scope === 'file');
  if (files.length < 2) return items;
  const firstIndex = items.findIndex((item) => item.id === files[0]?.id);
  const changes = boundFileChanges(files.flatMap((item) => item.changes));
  const status = files.reduce<TimelineTerminalStatus>((worst, item) => {
    const current = TERMINAL.has(item.status)
      ? item.status as TimelineTerminalStatus
      : 'interrupted';
    return STATUS_PRIORITY[current] > STATUS_PRIORITY[worst] ? current : worst;
  }, 'completed');
  const details = files.flatMap((item) => item.detail ? [item.detail] : []);
  const aggregate: FileOutcomeTimelineItem = {
    id: `timeline:file:turn:${turnId}`,
    sessionId: files[0]!.sessionId,
    turnId,
    kind: 'fileOutcome',
    scope: 'turn',
    sourceCallIds: files.flatMap((item) => item.sourceCallIds),
    lane: 'outcome',
    status,
    title: fileOutcomeTitle(status, changes.length),
    summary: `${changes.length} files affected`,
    changes,
    ...(details.length > 0 ? { detail: boundTimelineText(details.join('\n')) } : {}),
    startedAt: Math.min(...files.map((item) => item.startedAt ?? Number.MAX_SAFE_INTEGER)),
    completedAt: Math.max(...files.map((item) => item.completedAt ?? 0)),
    revision: Math.max(...files.map((item) => item.revision)) + 1,
  };
  const withoutFiles = items.filter((item) => !files.some((file) => file.id === item.id));
  withoutFiles.splice(firstIndex, 0, aggregate);
  return withoutFiles;
}
