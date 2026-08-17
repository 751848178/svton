import type { PermissionMode } from '@svton/agent-core';

export type PermissionProfilePhase =
  | 'idle'
  | 'applying'
  | 'persisting'
  | 'succeeded'
  | 'failed';

export interface PermissionProfileRequest {
  requestId: string;
  sessionId: string | null;
  from: PermissionMode;
  to: PermissionMode;
}

export type PermissionProfileResult =
  | {
      kind: 'succeeded';
      requestId: string;
      active: PermissionMode;
      persisted: PermissionMode;
    }
  | {
      kind: 'failed';
      requestId: string;
      active: PermissionMode;
      persisted: PermissionMode;
      code: 'blocked' | 'apply' | 'persistence';
      message: string;
      rolledBack: boolean;
      activeDefaultSplit: boolean;
    };

export type ReasoningChangeResult =
  | { kind: 'succeeded' }
  | { kind: 'failed'; code: 'blocked' | 'apply'; message: string };
