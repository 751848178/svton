/**
 * Pi foundation for svton.
 *
 * Single import surface for canonical Pi model/message/tool types so downstream
 * svton code imports them from `@svton/agent-core` instead of reaching into
 * `@earendil-works/pi-ai` directly. Provider registration uses the
 * provider-specific entrypoints (`/providers/openai`, `/providers/anthropic`)
 * deliberately — never the all-provider barrel.
 */
import {
  createModels,
  type Context,
  type CredentialStore,
  type Model,
  type MutableModels,
  type Tool,
} from '@earendil-works/pi-ai';
// Provider-specific entrypoints — never import from the all-provider barrel.
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

// Re-exported canonical types (pi-agent-core).
export type {
  Agent,
  AgentTool,
  AgentMessage,
  AgentLoopConfig,
} from '@earendil-works/pi-agent-core';

// Re-exported canonical types (pi-ai).
export type { Context, CredentialStore, Model, Tool };

/**
 * Builds the Pi `Models` collection with svton's two baseline LLM providers
 * (OpenAI + Anthropic) registered. Callers attach a credential store via the
 * options to bind auth; `SvtonPiCredentialStore` is the adapter.
 *
 * @returns the mutable models collection — also a `Models` (read + stream).
 */
export function createPiModels(
  options: { credentials?: CredentialStore } = {},
): MutableModels {
  const models = createModels(options.credentials ? { credentials: options.credentials } : {});
  models.setProvider(openaiProvider());
  models.setProvider(anthropicProvider());
  return models;
}
