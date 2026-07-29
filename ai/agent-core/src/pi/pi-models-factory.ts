/**
 * Pi models factory — replaces the deleted `OpenAIProvider`/`AnthropicProvider`
 * construction at every call site (create-agent, create-agent-config,
 * agent-setup desktop/web).
 *
 * Builds a pi-ai `Models` collection with OpenAI + Anthropic registered,
 * attaches svton's credential-store boundary, and resolves the pi-ai `Model`
 * for a given model id. Custom OpenAI-compatible endpoints (DeepSeek, Ollama,
 * vLLM, Azure) work via a synthesized model that carries the `baseUrl`, so
 * they route without catalog changes (Architecture §5.1, §6).
 */
import type { Model, Models, MutableModels, Provider } from '@earendil-works/pi-ai';
import { createModels } from '@earendil-works/pi-ai';
import { openaiProvider as registerOpenAI } from '@earendil-works/pi-ai/providers/openai';
import { anthropicProvider as registerAnthropic } from '@earendil-works/pi-ai/providers/anthropic';
import type { ModelInfo } from '../provider/types';
import { SvtonPiCredentialStore } from './credential-store';

/** Svton-supported LLM provider families. */
export type PiProviderFamily = 'openai' | 'anthropic';

/** Default base URLs per family (used when caller omits baseUrl). */
export const DEFAULT_BASE_URL: Record<PiProviderFamily, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

/** Pi-ai API id per family. */
export const FAMILY_API: Record<PiProviderFamily, string> = {
  openai: 'openai-responses',
  anthropic: 'anthropic-messages',
};

export interface CreatePiModelsOptions {
  /** Provider family to wire (selects the registered provider + default baseUrl). */
  family: PiProviderFamily;
  /** API key forwarded to the credential store. */
  apiKey?: string;
  /** Optional custom OpenAI/Anthropic-compatible endpoint. */
  baseUrl?: string;
  /** Svton UI model catalog — used for capability hints + model resolution. */
  models?: ModelInfo[];
  /**
   * Test/advanced injection point: a pi-ai `Provider` to register instead of
   * the real openai/anthropic provider. Tests pass a `fauxProvider(...)` to
   * script responses with no network and no real API key.
   */
  piProvider?: Provider;
}

export interface PiModelsHandle {
  /** The `Models` collection to feed into `AgentConfig.models`. */
  models: Models;
  /** The resolved pi-ai `Model` for the requested model id. */
  model: Model<any>;
}

/**
 * Build a `Models` collection and resolve the model for `modelId`.
 *
 * The collection is also returned as `MutableModels` so callers that need to
 * mutate providers post-construction can. `models.streamSimple.bind(models)`
 * is what Pi Agent consumes as its `streamFn`.
 */
export function createPiModelsForProvider(
  modelId: string,
  options: CreatePiModelsOptions,
): PiModelsHandle {
  const apiKeys: Record<string, string> = {};
  if (options.apiKey) apiKeys[options.family] = options.apiKey;
  const credentials = new SvtonPiCredentialStore(apiKeys);

  const models: MutableModels = createModels({ credentials });
  const provider = options.piProvider
    ? options.piProvider
    : options.family === 'anthropic'
      ? registerAnthropic()
      : registerOpenAI();
  models.setProvider(provider);

  // Try to resolve the model from the registered catalog first; fall back to a
  // synthesized model so custom ids / endpoints route without catalog changes.
  const resolved = resolveModel(models, modelId, options.family, options);
  return { models, model: resolved };
}

/** Resolve a model by id across providers, falling back to a synthesized model. */
export function resolveModel(
  models: Models,
  modelId: string,
  family: PiProviderFamily,
  options: CreatePiModelsOptions,
): Model<any> {
  for (const provider of models.getProviders()) {
    const model = models.getModel(provider.id, modelId);
    if (model) return model;
  }
  return synthesizePiModel(modelId, family, options);
}

/** Build a pi-ai `Model` from a svton model id + family + base URL. */
export function synthesizePiModel(
  modelId: string,
  family: PiProviderFamily,
  options: CreatePiModelsOptions,
): Model<string> {
  const catalog = options.models ?? [];
  const info = catalog.find((m) => m.id === modelId);
  const baseUrl = (options.baseUrl && trimTrailingSlash(options.baseUrl)) || DEFAULT_BASE_URL[family];
  const reasoning = info?.supportsThinking ?? false;
  const input: ('text' | 'image')[] = info?.supportsVision ? ['text', 'image'] : ['text'];
  return {
    id: modelId,
    name: info?.name ?? modelId,
    api: FAMILY_API[family],
    provider: family,
    baseUrl,
    reasoning,
    input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: info?.contextWindow ?? 128000,
    maxTokens: 8192,
  };
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Re-export for callers that build a Models collection directly (subagents).
export { SvtonPiCredentialStore };
export { createModels };
