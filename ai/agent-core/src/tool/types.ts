/**
 * Tool system type definitions.
 * Tools are defined separately from their execution - definitions are pure data,
 * executors are platform-dependent implementations.
 */

import type { ToolDefinition, ToolAnnotations } from '../provider/types';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';

// Re-export from provider
export type { ToolDefinition, ToolAnnotations };

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
}

export interface IToolExecutor {
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

export interface ToolEntry {
  definition: ToolDefinition;
  executor: IToolExecutor;
}
