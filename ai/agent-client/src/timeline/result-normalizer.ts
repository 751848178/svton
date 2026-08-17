import {
  redactPublicArguments,
  redactSecretRecord,
  redactSecrets,
  type ToolResult,
} from '@svton/agent-core';
import type {
  CommandExecutionTimelineItem,
  TimelineRetryDescriptor,
  TimelineTerminalStatus,
  ToolExecutionTimelineItem,
} from './types';
import { boundTimelineText } from './bounds';

export interface NormalizedToolOutcome {
  status: TimelineTerminalStatus;
  title: string;
  summary?: string;
  result?: string;
  command?: Partial<CommandExecutionTimelineItem>;
  retry?: TimelineRetryDescriptor;
}

export function isCommandTool(name: string): boolean {
  return name === 'bash' || name === 'shell' || name === 'e2e_command';
}

export function readCommandArgument(args: Record<string, unknown>): string | undefined {
  return typeof args.command === 'string'
    ? boundTimelineText(redactSecrets(args.command))
    : undefined;
}

export function createExecutionItem(input: {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sessionId: string;
  turnId: string;
  at: number;
}): ToolExecutionTimelineItem | CommandExecutionTimelineItem {
  const safeArguments = redactPublicArguments(input.arguments);
  const base = {
    id: input.callId,
    sessionId: input.sessionId,
    turnId: input.turnId,
    lane: 'process' as const,
    status: 'running' as const,
    title: isCommandTool(input.toolName) ? 'Command running' : `${input.toolName} running`,
    startedAt: input.at,
    revision: 0,
    toolName: input.toolName,
    progress: [],
  };
  if (isCommandTool(input.toolName)) {
    return { ...base, kind: 'commandExecution', command: readCommandArgument(safeArguments) };
  }
  return { ...base, kind: 'toolExecution', arguments: safeArguments };
}

export function normalizeToolOutcome(
  toolName: string,
  retryMessageId: string | undefined,
  result: ToolResult,
): NormalizedToolOutcome {
  const metadata = redactSecretRecord(result.metadata ?? {});
  const safeOutput = boundTimelineText(result.output);
  const command = isCommandTool(toolName) ? readCommandMetadata(metadata) : undefined;
  const approval = readApprovalOutcome(metadata.approval, toolName, safeOutput, command);
  if (approval) return approval;
  const failed = result.isError === true
    || command?.timedOut === true
    || typeof command?.signal === 'string'
    || (typeof command?.exitCode === 'number' && command.exitCode !== 0);
  const status = failed ? 'failed' as const : 'completed' as const;
  const retry = failed && retryMessageId
    ? { kind: 'message' as const, messageId: retryMessageId }
    : undefined;
  return {
    status,
    title: isCommandTool(toolName)
      ? `Command ${status}`
      : `${toolName} ${status}`,
    summary: firstLine(safeOutput),
    result: safeOutput,
    ...(command ? { command } : {}),
    ...(retry ? { retry } : {}),
  };
}

function readApprovalOutcome(
  value: unknown,
  toolName: string,
  result: string,
  command?: Partial<CommandExecutionTimelineItem>,
): NormalizedToolOutcome | null {
  if (!value || typeof value !== 'object') return null;
  const decision = (value as { decision?: unknown }).decision;
  const status = decision === 'decline'
    ? 'declined' as const
    : decision === 'cancel'
      ? 'cancelled' as const
      : decision === 'interrupted'
        ? 'interrupted' as const
        : null;
  if (!status) return null;
  return {
    status,
    title: `${toolName} ${status}`,
    summary: firstLine(result),
    result,
    ...(command ? { command } : {}),
  };
}

export function readCommandMetadata(
  metadata: Record<string, unknown>,
): Partial<CommandExecutionTimelineItem> {
  return compact({
    command: readString(metadata.command),
    cwd: readString(metadata.cwd),
    stdout: readString(metadata.stdout),
    stderr: readString(metadata.stderr),
    exitCode: readExitCode(metadata.exitCode),
    signal: readString(metadata.signal),
    timedOut: readBoolean(metadata.timedOut),
    durationMs: readNumber(metadata.durationMs),
    terminalReference: readString(metadata.terminalReference),
  });
}

function firstLine(value: string): string | undefined {
  const line = value.split('\n', 1)[0]?.trim();
  if (!line) return undefined;
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? boundTimelineText(value) : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readExitCode(value: unknown): number | null | undefined {
  if (value === null) return null;
  return readNumber(value);
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
