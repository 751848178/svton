/**
 * Provider-facing shared types.
 *
 * The `IProvider` / `StreamEvent` / `ChatOptions` provider contract and the
 * OpenAI/Anthropic implementations were deleted in PI002/PI003 — Pi Agent now
 * calls pi-ai `models.streamSimple` directly (Architecture §3, §5.1, §7.2). The
 * runtime emits the `AgentEvent` union (`agent/types.ts`), translated from Pi
 * events by `pi-event-adapter.ts`.
 *
 * What remains in this file are the svton-owned message/content/tool/usage
 * shapes that the event protocol, message bridge, tool registry and UI model
 * catalog still consume. `ModelInfo` is the svton UI model catalog shape used
 * by `createPiModelsForProvider` to resolve/synthesize pi-ai `Model` objects.
 */

// ============================================================
// Message Types
// ============================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;       // base64 or URL
  mimeType?: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  output: string;
  isError?: boolean;
}

export interface ReasoningContent {
  type: 'reasoning';
  text: string;
}

export type ContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent | ReasoningContent;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}

// ============================================================
// Tool Types (Provider-level)
// ============================================================

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  annotations?: ToolAnnotations;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// ============================================================
// Token Usage
// ============================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================
// Reasoning effort (user-facing reasoning intensity)
// ============================================================

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

// ============================================================
// Model Info
// ============================================================

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsToolUse: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
}
