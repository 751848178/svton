export type SessionManagementCommand =
  | 'rename'
  | 'pin'
  | 'unpin'
  | 'archive'
  | 'stopAndArchive'
  | 'unarchive'
  | 'delete';

export interface SessionManagementViewModel {
  sessionId: string;
  isPinned: boolean;
  isArchived: boolean;
  isRunning: boolean;
  commands: readonly SessionManagementCommand[];
}

export interface SessionManagementResult {
  ok: boolean;
  reason?: 'active' | 'invalid' | 'emptyTitle';
}

export interface SessionManagementController {
  rename: (sessionId: string, title: string) => Promise<SessionManagementResult>;
  setPinned: (sessionId: string, pinned: boolean) => Promise<SessionManagementResult>;
  archive: (sessionId: string) => Promise<SessionManagementResult>;
  stopAndArchive: (sessionId: string) => Promise<SessionManagementResult>;
  unarchive: (sessionId: string) => Promise<SessionManagementResult>;
  deletePermanently: (sessionId: string) => Promise<void>;
}
