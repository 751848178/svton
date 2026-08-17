/**
 * Tool system type definitions.
 * Tools are defined separately from their execution - definitions are pure data,
 * executors are platform-dependent implementations.
 */

import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';
import type { UserInputRequester } from '../agent/user-input.types';

export interface SvtonToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface SvtonToolMetadata {
  source?: 'builtin' | 'mcp' | 'integration' | 'subagent' | 'automation';
  sourceId?: string;
}

/** Pi base tool contract plus Svton-owned product/security annotations. */
export type SvtonToolParameters = AgentTool['parameters'];

export type SvtonToolDefinition = Omit<AgentTool, 'execute' | 'label'> & {
  label?: AgentTool['label'];
  annotations?: SvtonToolAnnotations;
  metadata?: SvtonToolMetadata;
};

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolContext {
  platform: IPlatform;
  sessionId: string;
  workingDir: string;
  sandboxProfile?: SandboxProfile | null;
  sandboxRequired?: boolean;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  requestUserInput?: UserInputRequester;
}

export interface IToolExecutor {
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

export interface ToolEntry {
  definition: SvtonToolDefinition;
  executor: IToolExecutor;
}
