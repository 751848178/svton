import type { ToolResult } from '@svton/agent-core';

export type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Ordered content block for rendering assistant messages in execution order.
 * Each block represents one logical piece: a thinking step, a tool invocation,
 * or a text response segment.
 */
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
  toolCalls?: DisplayToolCall[];
  /** Ordered content blocks — the authoritative source for rendering assistant messages in execution order */
  blocks?: ContentBlock[];
  isStreaming?: boolean;
  systemType?: 'default' | 'context_compacted';
  /** Duration in ms for completed assistant turns */
  duration?: number;
  timestamp: number;
}

export interface DisplayToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}

export interface PlanProgress {
  planId: string;
  title: string;
  steps: Array<{ id: string; title: string; status: string }>;
}
