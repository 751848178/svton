/**
 * Pi models factory used by SDK, App, Desktop and Web composition roots.
 *
 * Builds a pi-ai `Models` collection, attaches svton's credential-store
 * boundary, and resolves the pi-ai `Model` for a given model id. Provider
 * family selects authentication while an independent API protocol selects the
 * wire format. Custom OpenAI-compatible endpoints use Chat Completions unless
 * explicitly configured otherwise.
 */
import type { Model, Models, MutableModels, Provider } from '@earendil-works/pi-ai';
import { createModels, createProvider } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import { openaiProvider as registerOpenAI } from '@earendil-works/pi-ai/providers/openai';
import { anthropicProvider as registerAnthropic } from '@earendil-works/pi-ai/providers/anthropic';
import type { ModelInfo } from '../provider/types';
import { SvtonPiCredentialStore } from './credential-store';
import {
  resolvePiApiProtocol,
  resolvePiBaseUrl,
  type PiApiProtocol,
  type PiOpenAIApiProtocol,
  type PiProviderFamily,
} from './pi-api-protocol';

export {
  DEFAULT_BASE_URL,
  FAMILY_API,
  type PiApiProtocol,
  type PiProviderFamily,
} from './pi-api-protocol';

export interface CreatePiModelsOptions {
  /** Provider family to wire (selects the registered provider + default baseUrl). */
  family: PiProviderFamily;
  /** Wire protocol, independent from provider authentication family. */
  api?: PiApiProtocol;
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
  const provider = options.piProvider ?? createFamilyProvider(options.family);
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
  if (options.piProvider) {
    const injected = models.getModel(options.piProvider.id, modelId);
    if (injected) return injected;
  }
  const api = resolvePiApiProtocol(options);
  const baseUrl = resolvePiBaseUrl(options);
  for (const provider of models.getProviders()) {
    const model = models.getModel(provider.id, modelId);
    if (model && model.api === api && trimTrailingSlash(model.baseUrl) === baseUrl) {
      return model;
    }
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
  const baseUrl = resolvePiBaseUrl(options);
  const reasoning = info?.supportsThinking ?? false;
  const input: ('text' | 'image')[] = info?.supportsVision ? ['text', 'image'] : ['text'];
  return {
    id: modelId,
    name: info?.name ?? modelId,
    api: resolvePiApiProtocol(options),
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

function createFamilyProvider(family: PiProviderFamily): Provider {
  if (family === 'anthropic') return registerAnthropic();
  const openai = registerOpenAI();
  return createProvider<PiOpenAIApiProtocol>({
    id: openai.id,
    name: openai.name,
    baseUrl: openai.baseUrl,
    headers: openai.headers,
    auth: openai.auth,
    models: openai.getModels(),
    api: {
      'openai-completions': openAICompletionsApi(),
      'openai-responses': openAIResponsesApi(),
    },
  });
}

// Re-export for callers that build a Models collection directly (subagents).
export { SvtonPiCredentialStore };
export { createModels };
