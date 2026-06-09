/**
 * LLM Provider type definitions.
 * All providers implement the same IProvider interface,
 * producing a standardized stream of events.
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

export type ContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent;

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
// Streaming Events
// ============================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_end'; id: string; name: string; arguments: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; stopReason: string };

// ============================================================
// Chat Options
// ============================================================

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  systemPrompt?: string;
  signal?: AbortSignal;
  thinkingBudget?: number;   // for providers that support extended thinking
}

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

// ============================================================
// Provider Interface
// ============================================================

export interface IProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamEvent>;

  countTokens(text: string): number;
  supportsToolUse(model: string): boolean;
  supportsVision(model: string): boolean;
}
