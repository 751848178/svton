/**
 * React integration types — self-contained, no dependency on agent-client.
 */

import type { ToolResult, TokenUsage } from '@svton/agent-core';

// ============================================================
// Chat Status
// ============================================================

export type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

// ============================================================
// Display Message
// ============================================================

export interface DisplayToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}

export type ContentBlock =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: DisplayToolCall }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string };

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls: DisplayToolCall[];
  blocks: ContentBlock[];
  isStreaming?: boolean;
  systemType?: 'default' | 'context_compacted';
  duration?: number;
  timestamp: number;
}
