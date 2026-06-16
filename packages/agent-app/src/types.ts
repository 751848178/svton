/**
 * @svton/agent-app — Type definitions
 */

import type { AgentConfig } from '@svton/agent-core';
import type { SplitScreenContent } from '@svton/agent-ui';

// ============================================================
// Provider Configuration
// ============================================================

export interface ProviderConfig {
  type: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  name?: string;
  models: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
}

// ============================================================
// Feature Flags
// ============================================================

export interface FeatureFlags {
  /** Image generation (default: true) */
  imageGeneration?: boolean;
  /** Code review skill + git tools (default: true) */
  codeReview?: boolean;
  /** Document preview tool (default: true) */
  documentPreview?: boolean;
  /** CSV fan-out tool (default: true, needs subagent support) */
  csvFanout?: boolean;
  /** Web search (default: true if searchEndpoint provided) */
  webSearch?: boolean;
  /** Session resume / checkpoint (default: true) */
  sessionResume?: boolean;
  /** Custom agent definitions (default: true) */
  agentDefinitions?: boolean;
}

// ============================================================
// AgentApp Component Props
// ============================================================

export interface AgentAppProps {
  /** Provider configurations — at least one must have an API key */
  providers: ProviderConfig[];
  /** Default model ID (e.g. 'gpt-4o'). Falls back to first available. */
  defaultModel?: string;
  /** System prompt appended to the base template */
  systemPrompt?: string;
  /** Working directory hint (informational, no filesystem access in browser) */
  workingDir?: string;
  /** Web search endpoint URL */
  searchEndpoint?: string;
  /** Feature toggles — undefined features default to enabled */
  features?: FeatureFlags;
  /** Custom skill definitions to register */
  skills?: import('@svton/agent-core').SkillDefinition[];
  /** MCP server configs (HTTP/SSE only in browser) */
  mcpServers?: McpServerEntry[];
  /** Maximum ReAct iterations (default: 50) */
  maxIterations?: number;
  /** Context window config */
  contextConfig?: Partial<{
    maxTokens: number;
    compactionThreshold: number;
    preserveRecentMessages: number;
  }>;
  /** Custom CSS class */
  className?: string;
  /** App title shown in sidebar header */
  title?: string;
  /** Theme */
  theme?: 'dark' | 'light';
}

export interface McpServerEntry {
  name: string;
  url: string;
  type?: 'http' | 'sse';
  enabled?: boolean;
  headers?: Record<string, string>;
}

// ============================================================
// Internal types
// ============================================================

export type View = 'chat' | 'settings';

export interface ModelOption {
  id: string;
  name: string;
  providerName: string;
  providerType: string;
}
