/**
 * pi-ai `Usage` → svton `TokenUsage` mapping.
 *
 * Extracted from `pi-event-adapter.ts` to keep the event adapter focused on
 * event translation (code-structure-standards). Mirrors PI002's mapping:
 * input→promptTokens, output→completionTokens, totalTokens passthrough
 * (cache/reasoning/cost dropped at this seam).
 */
import type { Usage } from '@earendil-works/pi-ai';

/** Svton's 3-field token usage shape. */
export interface SvtonTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Map pi-ai `Usage` to svton's 3-field `TokenUsage`. */
export function piUsageToTokenUsage(usage: Usage | null | undefined): SvtonTokenUsage {
  if (!usage) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  return {
    promptTokens: usage.input ?? 0,
    completionTokens: usage.output ?? 0,
    totalTokens: usage.totalTokens ?? (usage.input ?? 0) + (usage.output ?? 0),
  };
}
