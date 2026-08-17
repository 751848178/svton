import type { SessionInfo } from './session.types';

export type SessionSearchMatch = 'title' | 'content';

export interface SessionSearchOptions {
  scope?: 'active' | 'archived';
  includeContent?: boolean;
  limit?: number;
}

export interface SessionSearchResult {
  session: SessionInfo;
  match: SessionSearchMatch;
  snippet?: string;
  source?: 'svton-content-extension';
}

export interface SessionSearchIndexRecord {
  schemaVersion: 1;
  sessionId: string;
  entries: SessionSearchIndexEntry[];
  updatedAt: number;
}

export interface SessionSearchIndexEntry {
  displayText: string;
  searchableText: string;
}
