/**
 * Provider-facing shared types barrel.
 *
 * PI002/PI003 deleted the `IProvider` implementations (OpenAIProvider,
 * AnthropicProvider), the temporary Pi bridge, and the `IProvider` /
 * `StreamEvent` / `ChatOptions` provider contract itself — Pi Agent calls
 * pi-ai `models.streamSimple` directly and emits the `AgentEvent` union.
 *
 * The svton-owned message/content/tool/usage shapes below are still consumed by
 * the event protocol, message bridge, tool registry and UI model catalog, so
 * they remain the public surface for those cross-cutting types. See
 * `provider/types.ts` for the per-type rationale.
 */
export type {
  ChatMessage,
  TokenUsage,
  ModelInfo,
  ToolDefinition,
  ToolAnnotations,
  ToolParameterSchema,
  ContentBlock,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolResultContent,
  ReasoningContent,
  ReasoningEffort,
} from './types';
