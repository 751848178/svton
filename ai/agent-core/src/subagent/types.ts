/**
 * Subagent types.
 */

import type { AgentConfig } from '../agent/types';
import type { TokenUsage } from '../provider/types';
import type { ChatMessage } from '../provider/types';

export interface SubagentConfig {
  /** The task to delegate */
  task: string;
  /** Optional model override */
  model?: string;
  /** Tools to allow (whitelist) */
  tools?: string[];
  /** Tools to exclude (blacklist) */
  excludeTools?: string[];
  /** Whether to isolate the context window (default: true) */
  isolatedContext?: boolean;
  /** Max iterations for the subagent */
  maxIterations?: number;
  /** Timeout in ms */
  timeout?: number;
  /** Description of the subagent's role */
  roleDescription?: string;
}

export interface SubagentResult {
  /** Unique ID of the subagent run */
  agentId: string;
  /** Summary of what the subagent accomplished */
  summary: string;
  /** Full message history (not injected into parent context) */
  messages: ChatMessage[];
  /** Token usage statistics */
  usage: TokenUsage;
  /** Whether the subagent completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}
