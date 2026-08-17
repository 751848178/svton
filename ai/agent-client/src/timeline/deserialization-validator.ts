import { redactPublicArguments } from '@svton/agent-core';
import { isTimelineEligibleTool } from './eligibility';
import {
  MAX_PROGRESS_ENTRIES,
  MAX_TIMELINE_ITEMS,
  boundProgressText,
  boundTimelineText,
} from './bounds';
import type {
  TimelineItem,
  TimelineItemBase,
  TimelineProgressEntry,
  TimelineRetryDescriptor,
  TimelineStatus,
  TimelineTurn,
} from './types';
import { parseApprovalDecision } from './approval-deserialization-validator';
import { parseFileOutcome } from './file-outcome-deserialization';
import { parseTimelineUsageState } from './usage-snapshot';

const STATUSES: TimelineStatus[] = [
  'pending', 'running', 'awaitingApproval', 'completed', 'failed',
  'declined', 'cancelled', 'interrupted',
];
const LANES = ['process', 'decision', 'outcome'] as const;
const TURN_STATUSES = ['running', 'completed', 'failed', 'interrupted'] as const;

export function parseTimelineTurn(value: unknown): TimelineTurn | undefined {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) return undefined;
  if (!isId(value.sessionId) || !isId(value.turnId)) return undefined;
  if (!TURN_STATUSES.includes(value.status as TimelineTurn['status'])) return undefined;
  if (!isRevision(value.revision) || !validOptionalNumbers(value, ['startedAt', 'completedAt', 'durationMs'])) {
    return undefined;
  }
  const usageState = parseTimelineUsageState(value);
  if (!usageState) return undefined;
  const items = value.items.slice(-MAX_TIMELINE_ITEMS)
    .map(parseTimelineItem)
    .filter((item): item is TimelineItem => Boolean(item))
    .filter((item) => item.sessionId === value.sessionId && item.turnId === value.turnId);
  if (items.length === 0 && !usageState.usage) return undefined;
  if (value.status !== 'running' && items.some((item) => isActionable(item.status))) {
    return undefined;
  }
  return {
    version: 1,
    sessionId: value.sessionId,
    turnId: value.turnId,
    status: value.status as TimelineTurn['status'],
    ...usageState,
    items,
    revision: value.revision,
    ...optionalNumbers(value, ['startedAt', 'completedAt', 'durationMs']),
  };
}

function isActionable(status: TimelineStatus): boolean {
  return status === 'pending' || status === 'running' || status === 'awaitingApproval';
}

function parseTimelineItem(value: unknown): TimelineItem | null {
  if (!isRecord(value)) return null;
  const common = parseCommon(value);
  if (!common) return null;
  if (value.kind === 'toolExecution') return parseTool(value, common);
  if (value.kind === 'commandExecution') return parseCommand(value, common);
  if (value.kind === 'fileOutcome') return parseFileOutcome(value, common);
  if (value.kind === 'approvalDecision') return parseApprovalDecision(value, common);
  if (value.kind === 'warning' || value.kind === 'error') return parseDiagnostic(value, common);
  return null;
}

function parseTool(value: Record<string, unknown>, common: TimelineItemBase): TimelineItem | null {
  if (!isId(value.toolName) || !isTimelineEligibleTool(value.toolName)) return null;
  if (!isRecord(value.arguments) || !Array.isArray(value.progress)) return null;
  const progress = parseProgress(value.progress);
  const retry = parseRetry(value.retry);
  if (!progress || retry === null || !optionalString(value.result)) return null;
  return {
    ...common,
    kind: 'toolExecution',
    toolName: value.toolName,
    arguments: redactPublicArguments(value.arguments),
    progress,
    ...(typeof value.result === 'string' ? { result: boundTimelineText(value.result) } : {}),
    ...(retry ? { retry } : {}),
  };
}

function parseCommand(value: Record<string, unknown>, common: TimelineItemBase): TimelineItem | null {
  if (!isId(value.toolName) || !isTimelineEligibleTool(value.toolName)) return null;
  if (!Array.isArray(value.progress) || !validCommandFields(value)) return null;
  const progress = parseProgress(value.progress);
  const retry = parseRetry(value.retry);
  if (!progress || retry === null) return null;
  return {
    ...common,
    kind: 'commandExecution',
    toolName: value.toolName,
    progress,
    ...optionalTexts(value, [
      'command', 'cwd', 'result', 'stdout', 'stderr', 'signal', 'terminalReference',
    ]),
    ...(value.exitCode === null || typeof value.exitCode === 'number'
      ? { exitCode: value.exitCode }
      : {}),
    ...(typeof value.timedOut === 'boolean' ? { timedOut: value.timedOut } : {}),
    ...(retry ? { retry } : {}),
  };
}

function parseDiagnostic(value: Record<string, unknown>, common: TimelineItemBase): TimelineItem | null {
  if (typeof value.diagnostic !== 'string' || !optionalString(value.code)) return null;
  const retry = parseRetry(value.retry);
  if (retry === null) return null;
  return {
    ...common,
    kind: value.kind as 'warning' | 'error',
    diagnostic: boundTimelineText(value.diagnostic),
    ...(typeof value.code === 'string' ? { code: boundTimelineText(value.code, 512) } : {}),
    ...(retry ? { retry } : {}),
  };
}

function parseCommon(value: Record<string, unknown>): TimelineItemBase | null {
  if (!isId(value.id) || !isId(value.sessionId) || !isId(value.turnId)) return null;
  if (!LANES.includes(value.lane as TimelineItemBase['lane'])) return null;
  if (!STATUSES.includes(value.status as TimelineStatus)) return null;
  if (typeof value.title !== 'string' || !isRevision(value.revision)) return null;
  if (!optionalString(value.summary) || !validOptionalNumbers(value, ['startedAt', 'completedAt', 'durationMs'])) {
    return null;
  }
  return {
    id: value.id,
    sessionId: value.sessionId,
    turnId: value.turnId,
    lane: value.lane as TimelineItemBase['lane'],
    status: value.status as TimelineStatus,
    title: boundTimelineText(value.title, 1_024),
    revision: value.revision,
    ...(typeof value.summary === 'string' ? { summary: boundTimelineText(value.summary) } : {}),
    ...optionalNumbers(value, ['startedAt', 'completedAt', 'durationMs']),
  };
}

function parseProgress(values: unknown[]): TimelineProgressEntry[] | null {
  const entries = values.slice(-MAX_PROGRESS_ENTRIES).map((value) => {
    if (!isRecord(value) || !isId(value.id) || typeof value.text !== 'string') return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    return { id: value.id, text: boundProgressText(value.text), createdAt: value.createdAt };
  });
  return entries.every(Boolean) ? entries as TimelineProgressEntry[] : null;
}

function parseRetry(value: unknown): TimelineRetryDescriptor | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.kind !== 'message' || !isId(value.messageId)) return null;
  return { kind: 'message', messageId: value.messageId };
}

function validCommandFields(value: Record<string, unknown>): boolean {
  const textFields = ['command', 'cwd', 'result', 'stdout', 'stderr', 'signal', 'terminalReference'];
  return textFields.every((key) => optionalString(value[key]))
    && (value.exitCode === undefined || value.exitCode === null
      || (typeof value.exitCode === 'number' && Number.isFinite(value.exitCode)))
    && (value.timedOut === undefined || typeof value.timedOut === 'boolean');
}

function optionalTexts(value: Record<string, unknown>, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.flatMap((key) => (
    typeof value[key] === 'string' ? [[key, boundTimelineText(value[key] as string)]] : []
  )));
}

function validOptionalNumbers(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => value[key] === undefined
    || (typeof value[key] === 'number' && Number.isFinite(value[key])));
}

function optionalNumbers(value: Record<string, unknown>, keys: string[]): Record<string, number> {
  return Object.fromEntries(keys.flatMap((key) => (
    typeof value[key] === 'number' ? [[key, value[key]]] : []
  ))) as Record<string, number>;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
