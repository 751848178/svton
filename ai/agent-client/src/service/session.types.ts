export const SESSION_SCHEMA_VERSION = 3 as const;

export type SessionTerminalKind = 'completed' | 'failed' | 'interrupted';
export type SessionTitleSource = 'auto' | 'manual';

export interface SessionActivityMetadata {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  lastTerminalAt?: number;
  lastTerminalKind?: SessionTerminalKind;
  lastTerminalRunId?: string;
  lastTerminalRevision?: number;
  lastReadAt?: number;
  lastReadRunId?: string;
  lastReadRevision?: number;
}

export interface SessionManagementMetadata {
  titleSource: SessionTitleSource;
  isPinned: boolean;
  archivedAt?: number;
  recencyAt: number;
}

export interface SessionInfo extends SessionActivityMetadata, SessionManagementMetadata {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

export interface SessionData extends SessionActivityMetadata, SessionManagementMetadata {
  id: string;
  title: string;
  model: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}
