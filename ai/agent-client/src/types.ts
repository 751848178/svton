import type { ToolResult } from '@svton/agent-core';

export type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls?: DisplayToolCall[];
  isStreaming?: boolean;
  systemType?: 'default' | 'context_compacted';
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
