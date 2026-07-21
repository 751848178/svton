/**
 * SessionResumeManager — persists and restores full runtime state.
 *
 * Checkpoints are stored under `agent:checkpoint:{sessionId}` in the platform's
 * IStorage. Each checkpoint captures the full message history, active model,
 * reasoning effort, and active plan ID.
 *
 * Usage:
 *   // After each run completes:
 *   await resumeManager.checkpoint(sessionId, runtime);
 *
 *   // To restore a session:
 *   const restored = await resumeManager.restore(sessionId, runtime);
 */

import type { IStorage } from '@svton/agent-platform';
import type { ChatMessage, ReasoningEffort } from '../provider/types';
import type { SerializedRuntime, CheckpointMeta } from './types';
import type { AgentRuntime } from '../agent/runtime';
import { parseSerializedRuntime } from './checkpoint-state.utils';
import { logger } from '../utils/logger';

const STORAGE_PREFIX = 'agent:checkpoint:';

export class SessionResumeManager {
  constructor(private storage: IStorage) {}

  /**
   * Save a checkpoint of the current runtime state.
   * Fire-and-forget safe — catches errors internally.
   */
  async checkpoint(
    sessionId: string,
    runtime: AgentRuntime,
  ): Promise<void> {
    try {
      const state = this.serializeRuntime(runtime);
      await this.storage.set(STORAGE_PREFIX + sessionId, JSON.stringify(state));
      logger.debug('Checkpoint', `Saved checkpoint for session ${sessionId}`, {
        messageCount: state.messages.length,
      });
    } catch (err) {
      logger.warn('Checkpoint', 'Failed to save checkpoint', { error: err });
    }
  }

  /**
   * Load a serialized runtime state without restoring it.
   */
  async load(sessionId: string): Promise<SerializedRuntime | null> {
    try {
      const raw = await this.storage.get<string>(STORAGE_PREFIX + sessionId);
      if (!raw) return null;
      return parseSerializedRuntime(raw);
    } catch {
      return null;
    }
  }

  /**
   * Load checkpoint metadata (without full messages) for listing.
   */
  async loadMeta(sessionId: string): Promise<CheckpointMeta | null> {
    const state = await this.load(sessionId);
    if (!state) return null;
    return {
      sessionId,
      messageCount: state.messages.length,
      model: state.model,
      updatedAt: state.updatedAt,
      planId: state.planId,
    };
  }

  /**
   * Restore a runtime from a saved checkpoint.
   * Sets messages, reasoning effort, and plan state.
   * @returns true if restore succeeded, false if no checkpoint found
   */
  async restore(sessionId: string, runtime: AgentRuntime): Promise<boolean> {
    const state = await this.load(sessionId);
    if (!state) {
      logger.debug('Checkpoint', `No checkpoint found for session ${sessionId}`);
      return false;
    }

    runtime.setMessages(state.messages);

    if (state.reasoningEffort) {
      runtime.setReasoningEffort(state.reasoningEffort);
    }

    logger.info('Checkpoint', `Restored session ${sessionId}`, {
      messageCount: state.messages.length,
      model: state.model,
      savedAt: new Date(state.updatedAt).toISOString(),
    });

    return true;
  }

  /**
   * Delete a checkpoint (e.g. when a session is deleted).
   */
  async delete(sessionId: string): Promise<void> {
    await this.storage.delete(STORAGE_PREFIX + sessionId);
  }

  /**
   * List all checkpoint metadata.
   */
  async listAll(): Promise<CheckpointMeta[]> {
    const keys = await this.storage.list(STORAGE_PREFIX);
    const results: CheckpointMeta[] = [];

    for (const key of keys) {
      try {
        const raw = await this.storage.get<string>(key);
        if (raw) {
          const state = parseSerializedRuntime(raw);
          if (!state) continue;
          results.push({
            sessionId: key.replace(STORAGE_PREFIX, ''),
            messageCount: state.messages.length,
            model: state.model,
            updatedAt: state.updatedAt,
            planId: state.planId,
          });
        }
      } catch {
        // Skip corrupted checkpoints
      }
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private serializeRuntime(runtime: AgentRuntime): SerializedRuntime {
    const messages = runtime.getMessages();
    const reasoningEffort = runtime.getReasoningEffort();

    return {
      messages,
      model: (runtime as unknown as { model: string }).model,
      reasoningEffort,
      updatedAt: Date.now(),
    };
  }
}
