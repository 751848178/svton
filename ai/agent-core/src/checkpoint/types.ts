/**
 * Session checkpoint types.
 * Used by SessionResumeManager to serialize/restore full runtime state.
 */

import type { ChatMessage } from '../provider/types';
import type { ReasoningEffort } from '../provider/types';

/**
 * Snapshot of the full runtime state at a point in time.
 * Persisted to storage so sessions can be fully restored later.
 */
export interface SerializedRuntime {
  messages: ChatMessage[];
  model: string;
  reasoningEffort?: ReasoningEffort;
  /** Active plan ID if a plan was in progress */
  planId?: string;
  /** Timestamp of this checkpoint */
  updatedAt: number;
}

/**
 * Metadata about a checkpoint (without the full message payload).
 * Used for listing checkpoints in UI.
 */
export interface CheckpointMeta {
  sessionId: string;
  messageCount: number;
  model: string;
  updatedAt: number;
  planId?: string;
}
