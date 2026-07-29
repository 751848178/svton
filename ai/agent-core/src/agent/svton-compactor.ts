/**
 * SvtonCompactor — context-window compaction policy, plugged into Pi Agent's
 * `transformContext` hook (Architecture §5.4).
 *
 * Pi Agent owns the message list; before each LLM call it hands the live
 * `AgentMessage[]` to `transformContext`, which may prune + summarize. This
 * module is the only place svton decides *when* and *how* to compact.
 *
 * Policy (ported from the deleted ContextManager, context.ts:6-9):
 *   maxTokens=128000, threshold=0.8, reserved=4096, preserveRecent=6.
 *
 * When the token estimate crosses the threshold:
 *   - keep the system + most-recent N messages verbatim,
 *   - summarize the middle via an LLM call (pi-ai `Models.streamSimple`),
 *   - inject the summary as a user message,
 *   - return the pruned list.
 *
 * The compactor reports compaction via an `onCompacted` callback so the
 * runtime can emit a svton `context_compacted` AgentEvent (Pi owns the loop
 * and has no notion of svton's event protocol). Stateless helpers live in
 * `compactor-helpers.ts`.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { Message, Models, Model } from '@earendil-works/pi-ai';
import { logger } from '../utils/logger';
import { estimateTokens, formatForSummary, summaryUserMessage } from './compactor-helpers';

const DEFAULT_MAX_TOKENS = 128000;
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_RESERVED = 4096;
const DEFAULT_PRESERVE_RECENT = 6;

export interface SvtonCompactorConfig {
  maxTokens?: number;
  compactionThreshold?: number;
  reservedForResponse?: number;
  preserveRecentMessages?: number;
}

export interface CompactionOutcome {
  removed: number;
  summary?: string;
}

export type CompactionReporter = (outcome: CompactionOutcome) => void;

/**
 * Pluggable compactor. Construct once per runtime; `bind()` returns the
 * `(messages, signal) => Promise<AgentMessage[]>` shape Pi's `transformContext`
 * expects.
 */
export class SvtonCompactor {
  private readonly maxTokens: number;
  private readonly threshold: number;
  private readonly reserved: number;
  private readonly preserveRecent: number;
  private models: Models | null = null;
  private model: Model<any> | null = null;

  constructor(config: SvtonCompactorConfig = {}) {
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.threshold = config.compactionThreshold ?? DEFAULT_THRESHOLD;
    this.reserved = config.reservedForResponse ?? DEFAULT_RESERVED;
    this.preserveRecent = config.preserveRecentMessages ?? DEFAULT_PRESERVE_RECENT;
  }

  /**
   * Attach the LLM runtime used for summarization. Required only if
   * LLM-based summaries are desired; without it compaction falls back to
   * simple truncation.
   */
  bind(models: Models, model: Model<any>): void {
    this.models = models;
    this.model = model;
  }

  /** Build the Pi `transformContext` hook bound to `report` for event emission. */
  toTransformContext(report?: CompactionReporter) {
    return async (messages: AgentMessage[], signal?: AbortSignal): Promise<AgentMessage[]> => {
      try {
        return await this.compact(messages, signal, report);
      } catch (err) {
        // transformContext must never reject (Architecture §5.4 / Pi contract).
        logger.warn('Compactor', 'transformContext failed, returning original messages', { error: err });
        return messages;
      }
    };
  }

  private async compact(
    messages: AgentMessage[],
    signal: AbortSignal | undefined,
    report?: CompactionReporter,
  ): Promise<AgentMessage[]> {
    const estimate = estimateTokens(messages);
    const limit = this.maxTokens * this.threshold - this.reserved;
    if (estimate < limit) return messages;

    const recent = messages.slice(-this.preserveRecent);
    const removable = messages.slice(0, messages.length - this.preserveRecent);

    // Even when nothing is removable (e.g. a single oversized message), mirror
    // the legacy ContextManager behavior of reporting that compaction ran.
    if (removable.length === 0) {
      report?.({ removed: 0 });
      return messages;
    }

    let summaryText: string | undefined;
    if (this.models && this.model) {
      summaryText = await this.summarizeWithLLM(removable, signal);
    }

    const kept: AgentMessage[] = [];
    if (summaryText) kept.push(summaryUserMessage(summaryText));
    kept.push(...recent);

    report?.({ removed: removable.length, summary: summaryText });
    return kept;
  }

  private async summarizeWithLLM(
    messages: AgentMessage[],
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    if (!this.models || !this.model) return undefined;
    try {
      const formatted = messages.map(formatForSummary).join('\n\n');
      // pi-ai's `Message` union has no `system` role; the system prompt is a
      // top-level `Context.systemPrompt` field. Keep only the user message in
      // `messages` and pass the summarization instructions as `systemPrompt`.
      const summaryMessages: Message[] = [
        { role: 'user', content: formatted, timestamp: Date.now() },
      ];
      const stream = this.models.streamSimple(
        this.model,
        {
          systemPrompt:
            'Summarize the following conversation excerpt concisely. Preserve: key facts, decisions, user preferences, important results, and any unresolved issues. Use bullet points. Keep under 500 words.',
          messages: summaryMessages,
        },
        { signal, maxTokens: 1000 },
      );
      let summary = '';
      for await (const ev of stream) {
        if (signal?.aborted) break;
        if (ev.type === 'text_delta') summary += ev.delta;
      }
      return summary.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
