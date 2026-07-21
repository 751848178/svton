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
  metadata?: Record<string, unknown>;
  result?: ToolResult;
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}

export interface PlanProgress {
  planId: string;
  title: string;
  steps: Array<{ id: string; title: string; status: string }>;
}

export interface SearchResultEntry {
  title: string;
  url: string;
  snippet?: string;
}

export interface ReferenceEntry {
  path: string;
  line?: number;
  snippet?: string;
}

export interface FileChange {
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  diff?: string;
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
}

export interface GeneratedImage {
  url?: string;
  base64?: string;
  mimeType?: string;
  revisedPrompt?: string;
}

export interface CodeReviewFinding {
  file: string;
  line?: number;
  severity: 'info' | 'warning' | 'error';
  comment: string;
}

export interface CsvFanoutRow {
  rowIndex: number;
  status: string;
  rowData: Record<string, string>;
  summary?: string;
}

export interface PreviewImagesBlock {
  type: 'preview_images';
  images: string[];
  title: string;
}

export type ContentBlock =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: DisplayToolCall }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string }
  | { type: 'plan'; plan: PlanProgress }
  | { type: 'redacted_thinking'; reason?: string }
  | { type: 'web_search'; query: string; results: SearchResultEntry[] }
  | { type: 'reference'; refs: ReferenceEntry[] }
  | { type: 'progress'; text: string; status: 'running' | 'done' }
  | { type: 'file_change'; changes: FileChange[] }
  | { type: 'turn_diff'; changes: FileChange[] }
  | { type: 'command'; label: string; action: string; icon?: string }
  | { type: 'file_tree'; tree: FileTreeNode[] }
  | { type: 'image_generated'; images: GeneratedImage[]; model: string }
  | PreviewImagesBlock
  | { type: 'code_review'; findings: CodeReviewFinding[] }
  | { type: 'csv_fanout'; totalRows: number; succeeded: number; failed: number; rows: CsvFanoutRow[] }
  | { type: 'auto_review'; toolName: string; verdict: 'approve' | 'deny' | 'ask_user'; reason: string; ruleId?: string }
  | { type: 'subagent'; agentId: string; task: string; status: 'pending' | 'running' | 'completed' | 'error'; summary?: string }
  | { type: 'warning'; text: string; source?: string };

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
  activeSkills?: string[];
  duration?: number;
  timestamp: number;
}
