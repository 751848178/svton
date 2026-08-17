import {
  applyReadMetadata,
  applyTerminalMetadata,
} from './session-activity.reducer';
import type {
  SessionTerminalIdentity,
  TerminalRunState,
} from './session-activity.types';
import { SESSION_SCHEMA_VERSION, type SessionData, type SessionInfo } from './session.types';
import { readSessionMetadata } from './session-metadata-migration';

export function createSessionRecords(input: {
  id: string;
  title: string;
  model: string;
  projectId?: string;
  titleSource?: 'auto' | 'manual';
  now: number;
}): { data: SessionData; info: SessionInfo } {
  const base = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: input.id,
    title: input.title,
    titleSource: input.titleSource ?? 'auto',
    isPinned: false,
    recencyAt: input.now,
    model: input.model,
    createdAt: input.now,
    updatedAt: input.now,
    projectId: input.projectId,
  };
  return {
    data: { ...base, messages: [] },
    info: { ...base, messageCount: 0 },
  };
}

export function prepareSessionSave(
  data: SessionData,
  current: SessionInfo | undefined,
  now: number,
  terminal?: TerminalRunState,
): { data: SessionData; info: SessionInfo } {
  const metadataSource = current ?? data;
  const metadata = terminal
    ? applyTerminalMetadata(metadataSource, terminal)
    : metadataSource;
  const sessionMetadata = readSessionMetadata(metadata);
  const manualTitle = current?.titleSource === 'manual';
  const hasMessageActivity = !current || data.messages.length > current.messageCount;
  const hasTerminalActivity = !!terminal && (
    terminal.runId !== current?.lastTerminalRunId
    || terminal.revision !== current?.lastTerminalRevision
  );
  const recencyAt = hasMessageActivity || hasTerminalActivity
    ? Math.max(metadataSource.recencyAt ?? 0, now)
    : metadataSource.recencyAt ?? metadataSource.updatedAt;
  const saved: SessionData = {
    ...data,
    ...sessionMetadata,
    title: manualTitle ? current.title : data.title,
    titleSource: manualTitle ? 'manual' : 'auto',
    recencyAt,
    updatedAt: now,
  };
  return {
    data: saved,
    info: {
      ...readSessionMetadata(saved),
      id: saved.id,
      title: saved.title,
      model: saved.model,
      messageCount: saved.messages.length,
      createdAt: saved.createdAt,
      updatedAt: now,
      projectId: saved.projectId,
    },
  };
}

export function prepareSessionRead(
  data: SessionData,
  info: SessionInfo,
  terminal: SessionTerminalIdentity,
  at: number,
): { data: SessionData; info: SessionInfo } | null {
  const nextInfo = applyReadMetadata(info, terminal, at);
  if (nextInfo === info) return null;
  const durableData = { ...data, ...readSessionMetadata(info) };
  return {
    info: nextInfo,
    data: applyReadMetadata(durableData, terminal, at),
  };
}
