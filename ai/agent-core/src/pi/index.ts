/**
 * Pi integration barrel for svton agent-core.
 *
 * Canonical Pi model/message/tool types + the svton credential-store
 * boundary, the models factory, and the model-resolution helpers. Import
 * these from `@svton/agent-core` so the rest of the monorepo does not depend
 * on `@earendil-works/pi-ai` directly.
 *
 * Pi Agent calls `models.streamSimple` directly (Architecture §3, §7.2).
 */
export { createPiModels, fauxProvider, fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from './foundation';
export type {
  Agent,
  AgentLoopConfig,
  AgentMessage,
  AgentTool,
  AssistantMessage,
  Context,
  CredentialStore,
  Model,
  Provider,
  Tool,
} from './foundation';
export { SvtonPiCredentialStore } from './credential-store';
export {
  createPiModelsForProvider,
  resolveModel,
  synthesizePiModel,
  DEFAULT_BASE_URL,
  FAMILY_API,
  type CreatePiModelsOptions,
  type PiModelsHandle,
  type PiProviderFamily,
} from './pi-models-factory';
export {
  DEFAULT_API_BY_FAMILY,
  resolvePiApiProtocol,
  resolvePiBaseUrl,
  type PiApiProtocol,
  type PiApiProtocolOptions,
  type PiOpenAIApiProtocol,
} from './pi-api-protocol';
