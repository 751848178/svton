/**
 * Provider-facing shared types.
 *
 * The `IProvider` / `StreamEvent` / `ChatOptions` provider contract and the
 * OpenAI/Anthropic implementations were deleted in PI002/PI003 — Pi Agent now
 * calls pi-ai `models.streamSimple` directly (Architecture §3, §5.1, §7.2). The
 * runtime emits the `AgentEvent` union (`agent/types.ts`), translated from Pi
 * events by `pi-event-adapter.ts`.
 *
 * What remains in this file are Svton-owned usage, reasoning, and UI model
 * catalog types. Pi owns message, content, and base tool contracts.
 */

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
