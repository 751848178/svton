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
export interface FileChange {
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  diff?: string;
}

export interface ReferenceEntry {
  path: string;
  line?: number;
  snippet?: string;
}

export interface SearchResultEntry {
  title: string;
  url: string;
  snippet?: string;
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
}

export type ContentBlock =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: DisplayToolCall }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string }
  | { type: 'plan'; plan: PlanProgress }
  | { type: 'file_change'; changes: FileChange[] }
  | { type: 'subagent'; agentId: string; task: string; status: 'running' | 'completed'; summary?: string }
  | { type: 'warning'; text: string; source?: string }
  | { type: 'reference'; refs: ReferenceEntry[] }
  | { type: 'web_search'; query: string; results: SearchResultEntry[] }
  | { type: 'progress'; text: string; status: 'running' | 'done' }
  | { type: 'turn_diff'; changes: FileChange[] }
  | { type: 'command'; label: string; action: string; icon?: string }
  | { type: 'file_tree'; tree: FileTreeNode[] }
  | { type: 'redacted_thinking'; reason?: string }
  | { type: 'image_generated'; images: Array<{ url?: string; base64?: string; revisedPrompt?: string }>; model: string }
  | { type: 'code_review'; findings: Array<{ file: string; line?: number; severity: 'info' | 'warning' | 'error'; comment: string }> }
  | { type: 'csv_fanout'; totalRows: number; succeeded: number; failed: number; rows: Array<{ rowIndex: number; status: string; rowData: Record<string, string>; summary?: string }> }
  | { type: 'auto_review'; toolName: string; verdict: 'approve' | 'deny' | 'ask_user'; reason: string; ruleId?: string };

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
  /** Skills active for this assistant turn — surfaced in the activity indicator */
  activeSkills?: string[];
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
