import { redactPublicArguments, type ToolResult } from '@svton/agent-core';
import { boundTimelineText } from './bounds';
import { boundFileChanges, MAX_FILE_PATH } from './file-outcome-bounds';
import type {
  FileOutcomeTimelineItem,
  TimelineTerminalStatus,
} from './types';

const FILE_CHANGE_TOOLS = new Set([
  'file_write', 'file_edit', 'write_file', 'edit_file', 'apply_diff',
]);

export function isFileChangeTool(toolName: string): boolean {
  return FILE_CHANGE_TOOLS.has(toolName);
}

export function fileOutcomeId(callId: string): string {
  return `timeline:file:call:${callId}`;
}

export function createFileOutcomeItem(input: {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sessionId: string;
  turnId: string;
  at: number;
}): FileOutcomeTimelineItem | null {
  if (!isFileChangeTool(input.toolName)) return null;
  const safeArguments = redactPublicArguments(input.arguments);
  const path = readFileChangePath(safeArguments);
  if (!path) return null;
  const changeType = readFileChangeType(input.toolName);
  return {
    id: fileOutcomeId(input.callId),
    sessionId: input.sessionId,
    turnId: input.turnId,
    kind: 'fileOutcome',
    scope: 'file',
    sourceCallIds: [input.callId],
    lane: 'outcome',
    status: 'running',
    title: 'File change running',
    summary: `${changeType} ${path}`,
    changes: [{ sourceCallId: input.callId, path, changeType, status: 'running' }],
    startedAt: input.at,
    revision: 0,
  };
}

export function normalizeFileOutcomeFinish(
  callId: string,
  status: TimelineTerminalStatus,
  result: ToolResult,
) {
  const output = boundTimelineText(result.output);
  return {
    id: fileOutcomeId(callId),
    status,
    title: fileOutcomeTitle(status),
    ...(status === 'completed' && output ? { diff: output } : {}),
    ...(status !== 'completed' && output ? { detail: output } : {}),
  };
}

export function fileOutcomeTitle(status: TimelineTerminalStatus, count = 1): string {
  const subject = count === 1 ? 'File change' : `${count} file changes`;
  return `${subject} ${status}`;
}

export function readFileChangePath(args: Record<string, unknown>): string | null {
  const value = typeof args.path === 'string'
    ? args.path
    : typeof args.file_path === 'string' ? args.file_path : '';
  const path = boundTimelineText(value, MAX_FILE_PATH).trim();
  return path.length > 0 ? path : null;
}

export function readFileChangeType(toolName: string): 'create' | 'modify' {
  return toolName.includes('write') || toolName.includes('create') ? 'create' : 'modify';
}

export function withBoundedFileChanges(
  item: FileOutcomeTimelineItem,
): FileOutcomeTimelineItem {
  return { ...item, changes: boundFileChanges(item.changes) };
}
