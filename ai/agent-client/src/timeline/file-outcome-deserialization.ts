import { boundTimelineText } from './bounds';
import {
  boundFileChanges,
  MAX_FILE_CHANGES,
  MAX_FILE_PATH,
} from './file-outcome-bounds';
import type {
  FileOutcomeTimelineItem,
  FileTimelineChange,
  TimelineItemBase,
  TimelineStatus,
} from './types';

const STATUSES: TimelineStatus[] = [
  'pending', 'running', 'awaitingApproval', 'completed', 'failed',
  'declined', 'cancelled', 'interrupted',
];
const CHANGE_TYPES = ['create', 'modify', 'delete'] as const;

export function parseFileOutcome(
  value: Record<string, unknown>,
  common: TimelineItemBase,
): FileOutcomeTimelineItem | null {
  if (value.scope !== 'file' && value.scope !== 'turn') return null;
  if (!Array.isArray(value.sourceCallIds) || value.sourceCallIds.length === 0) return null;
  if (!value.sourceCallIds.every(isId) || !Array.isArray(value.changes)) return null;
  if (value.changes.length === 0 || value.changes.length > MAX_FILE_CHANGES) return null;
  const changes = value.changes.map(parseChange);
  if (changes.some((change) => change === null)) return null;
  if (value.detail !== undefined && typeof value.detail !== 'string') return null;
  return {
    ...common,
    kind: 'fileOutcome',
    scope: value.scope,
    sourceCallIds: value.sourceCallIds,
    changes: boundFileChanges(changes as FileTimelineChange[]),
    ...(typeof value.detail === 'string' ? { detail: boundTimelineText(value.detail) } : {}),
  };
}

function parseChange(value: unknown): FileTimelineChange | null {
  if (!isRecord(value) || !isId(value.sourceCallId) || !isPath(value.path)) return null;
  if (!CHANGE_TYPES.includes(value.changeType as FileTimelineChange['changeType'])) return null;
  if (!STATUSES.includes(value.status as TimelineStatus)) return null;
  if (value.diff !== undefined && typeof value.diff !== 'string') return null;
  return {
    sourceCallId: value.sourceCallId,
    path: value.path,
    changeType: value.changeType as FileTimelineChange['changeType'],
    status: value.status as TimelineStatus,
    ...(typeof value.diff === 'string' ? { diff: value.diff } : {}),
  };
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function isPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FILE_PATH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
