/**
 * Input history — persistence + normalization for the user's past prompts.
 *
 * Extracted from ChatService (PI007) to keep the service focused on agent
 * orchestration. Owns the one-way flow:
 *   record() → normalize/merge → publish(items) → storage.
 *
 * The observable `inputHistory` array itself lives on ChatService (so the
 * @svton/service subscription layer sees it); this module publishes normalized
 * results through the `publish` callback passed in `attach`.
 */

import { logger } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { DisplayMessage } from '../types';

const INPUT_HISTORY_KEY = 'agent:input_history:v1';
const MAX_INPUT_HISTORY_ITEMS = 100;
const MAX_INPUT_HISTORY_CHARS = 20000;

export interface InputHistoryBindings {
  platform: IPlatform;
  /** Read the current observable value (so equality checks avoid no-op writes). */
  get: () => string[];
  /** Write the normalized result back to the observable. */
  publish: (items: string[]) => void;
}

export class InputHistoryStore {
  private bindings: InputHistoryBindings | null = null;
  private loaded = false;
  private pendingValues: string[] = [];

  /** Bind to a platform + observable publisher, then lazily load. Idempotent. */
  async attach(bindings: InputHistoryBindings): Promise<void> {
    this.bindings = bindings;
    await this.load();
  }

  /** Record a single user prompt. */
  record(content: string): void {
    this.addItems([content]);
  }

  /** Seed history from the user messages of a restored transcript. */
  recordFromMessages(messages: DisplayMessage[]): void {
    this.addItems(
      messages.filter((m) => m.role === 'user').map((m) => m.content),
      false,
    );
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async load(): Promise<void> {
    if (this.loaded || !this.bindings) return;
    const { platform, publish } = this.bindings;

    try {
      const raw = await platform.storage.get<unknown>(INPUT_HISTORY_KEY);
      const stored = Array.isArray(raw) ? raw : [];
      const pending = this.pendingValues;
      this.pendingValues = [];
      const next = this.normalize([...stored, ...pending]);
      this.loaded = true;
      publish(next);
      if (pending.length > 0) void this.persist(next);
    } catch (error) {
      this.loaded = true;
      logger.warn('Chat', 'Failed to load input history', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private addItems(values: unknown[], moveExistingToEnd = true): void {
    const items = this.normalize(values);
    if (items.length === 0 || !this.bindings) return;

    if (!this.loaded) {
      this.pendingValues = this.merge(this.pendingValues, items, moveExistingToEnd);
      const optimistic = this.merge(this.bindings.get(), items, moveExistingToEnd);
      this.bindings.publish(optimistic);
      return;
    }
    this.set(this.merge(this.bindings.get(), items, moveExistingToEnd));
  }

  private set(values: unknown[]): void {
    if (!this.bindings) return;
    const next = this.normalize(values);
    if (this.equal(this.bindings.get(), next)) return;
    this.bindings.publish(next);
    void this.persist(next);
  }

  private async persist(history: string[]): Promise<void> {
    if (!this.bindings) return;
    try {
      await this.bindings.platform.storage.set(INPUT_HISTORY_KEY, history);
    } catch (error) {
      logger.warn('Chat', 'Failed to persist input history', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalize(values: unknown[]): string[] {
    const out: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_INPUT_HISTORY_CHARS) continue;
      const idx = out.indexOf(trimmed);
      if (idx !== -1) out.splice(idx, 1);
      out.push(trimmed);
    }
    return out.slice(-MAX_INPUT_HISTORY_ITEMS);
  }

  private merge(base: unknown[], values: unknown[], moveExistingToEnd: boolean): string[] {
    const merged = this.normalize(base);
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_INPUT_HISTORY_CHARS) continue;
      const idx = merged.indexOf(trimmed);
      if (idx !== -1) {
        if (!moveExistingToEnd) continue;
        merged.splice(idx, 1);
      }
      merged.push(trimmed);
    }
    return merged.slice(-MAX_INPUT_HISTORY_ITEMS);
  }

  private equal(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
}
