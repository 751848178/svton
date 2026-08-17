import {
  SESSION_SCHEMA_VERSION,
  type SessionActivityMetadata,
  type SessionData,
  type SessionInfo,
  type SessionManagementMetadata,
  type SessionTerminalKind,
  type SessionTitleSource,
} from './session.types';

const TERMINAL_KINDS = new Set<SessionTerminalKind>([
  'completed', 'failed', 'interrupted',
]);

const TITLE_SOURCES = new Set<SessionTitleSource>(['auto', 'manual']);

/** Totally normalizes legacy, partial-v2, and v3 session metadata. */
export function migrateSessionInfo(value: object): SessionInfo {
  return { ...withoutSessionMetadata(value), ...readSessionMetadata(value) } as SessionInfo;
}

export function migrateSessionData(value: object): SessionData {
  return { ...withoutSessionMetadata(value), ...readSessionMetadata(value) } as SessionData;
}

export function readSessionMetadata(
  value: object,
): SessionActivityMetadata & SessionManagementMetadata {
  const source = value as Record<string, unknown>;
  const titleSource = TITLE_SOURCES.has(source.titleSource as SessionTitleSource)
    ? source.titleSource as SessionTitleSource
    : 'auto';
  const archivedAt = finiteNumber(source.archivedAt);
  const recencyAt = finiteNumber(source.recencyAt)
    ?? finiteNumber(source.updatedAt)
    ?? finiteNumber(source.createdAt)
    ?? 0;
  return {
    ...readActivityMetadata(value),
    titleSource,
    isPinned: source.isPinned === true,
    ...(archivedAt !== undefined ? { archivedAt } : {}),
    recencyAt,
  };
}

export function readActivityMetadata(value: object): SessionActivityMetadata {
  const source = value as Record<string, unknown>;
  const terminalAt = finiteNumber(source.lastTerminalAt);
  const terminalKind = TERMINAL_KINDS.has(source.lastTerminalKind as SessionTerminalKind)
    ? source.lastTerminalKind as SessionTerminalKind
    : undefined;
  const terminalRunId = boundedString(source.lastTerminalRunId);
  const terminalRevision = nonNegativeInteger(source.lastTerminalRevision);
  const hasTerminal = terminalAt !== undefined
    && terminalKind !== undefined
    && terminalRunId !== undefined
    && terminalRevision !== undefined;
  const readAt = finiteNumber(source.lastReadAt);
  const readRunId = boundedString(source.lastReadRunId);
  const readRevision = nonNegativeInteger(source.lastReadRevision);
  const hasRead = readAt !== undefined
    && readRunId !== undefined
    && readRevision !== undefined;
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    ...(hasTerminal ? {
      lastTerminalAt: terminalAt,
      lastTerminalKind: terminalKind,
      lastTerminalRunId: terminalRunId,
      lastTerminalRevision: terminalRevision,
    } : {}),
    ...(hasRead ? {
      lastReadAt: readAt,
      lastReadRunId: readRunId,
      lastReadRevision: readRevision,
    } : {}),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function boundedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    ? value
    : undefined;
}

function withoutSessionMetadata<T extends object>(
  value: T,
): Omit<T, keyof SessionActivityMetadata | keyof SessionManagementMetadata> {
  const {
    schemaVersion: _schemaVersion,
    lastTerminalAt: _lastTerminalAt,
    lastTerminalKind: _lastTerminalKind,
    lastTerminalRunId: _lastTerminalRunId,
    lastTerminalRevision: _lastTerminalRevision,
    lastReadAt: _lastReadAt,
    lastReadRunId: _lastReadRunId,
    lastReadRevision: _lastReadRevision,
    titleSource: _titleSource,
    isPinned: _isPinned,
    archivedAt: _archivedAt,
    recencyAt: _recencyAt,
    ...rest
  } = value as T & SessionActivityMetadata & SessionManagementMetadata;
  return rest;
}
