/**
 * Small stateless helpers used by the SvtonAgentRuntime composition root.
 *
 * Extracted from `svton-agent-runtime.ts` to keep the composition root focused
 * on lifecycle + the public API surface (code-structure-standards).
 */
import type { Models, Model } from '@earendil-works/pi-ai';
import type { ReasoningEffort } from '../provider/types';

/** Resolve a pi-ai Model by id, searching all registered providers. */
export function resolveModelById(models: Models, modelId: string): Model<any> {
  for (const provider of models.getProviders()) {
    const model = models.getModel(provider.id, modelId);
    if (model) return model;
  }
  // Fall back to the first available model so tests without an exact catalog
  // match still run.
  const anyModel = models.getModels()[0];
  if (anyModel) return anyModel;
  throw new Error(`No model found for id "${modelId}" and no providers registered.`);
}

/** Map svton ReasoningEffort to pi-ai ThinkingLevel. */
export function reasoningToThinkingLevel(effort: ReasoningEffort | undefined) {
  if (!effort) return 'off' as const;
  const map = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' } as const;
  return map[effort];
}
