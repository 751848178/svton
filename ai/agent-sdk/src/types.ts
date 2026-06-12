/**
 * SDK-level simplified type definitions.
 *
 * These types provide a flat, easy-to-understand configuration surface
 * for external teams. Under the hood they are mapped to agent-core types.
 */

import type {
  ContentBlock,
  ContextConfig,
  HookEvent,
  HookHandler,
  ModelInfo,
  PermissionMode,
  SkillDefinition,
  ToolAnnotations,
  ToolContext,
  ToolParameterSchema,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ============================================================
// Provider Config
// ============================================================

export interface ProviderConfig {
  /** Provider type: 'openai' (also works for Azure, Ollama, vLLM, DeepSeek) or 'anthropic' */
  type: 'openai' | 'anthropic';
  /** API key for authentication */
  apiKey: string;
  /** Base URL (default depends on type: 'https://api.openai.com' or 'https://api.anthropic.com') */
  baseUrl?: string;
  /** Custom headers to include in every request */
  customHeaders?: Record<string, string>;
  /** Model list override (if omitted, provider defaults are used) */
  models?: ModelInfo[];
}

// ============================================================
// User Tool Definition
// ============================================================

export interface UserToolDefinition {
  /** Tool name (must be unique) */
  name: string;
  /** Description for the LLM to understand when to use this tool */
  description: string;
  /** JSON Schema parameters */
  parameters: ToolParameterSchema;
  /** Execution function — receives parsed args and context, returns string output */
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
  /** Optional hints about the tool's behavior */
  annotations?: ToolAnnotations;
}

// ============================================================
// MCP Server Config
// ============================================================

export interface SdkMcpServerConfig {
  /** Server endpoint URL */
  url: string;
  /** Transport type */
  type: 'http' | 'sse';
  /** Display name (used as prefix for bridged tools: mcp__{name}__tool) */
  name?: string;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
  /** Per-server tool filtering */
  toolFilter?: {
    enabled?: string[];
    disabled?: string[];
    approvalMode?: 'auto' | 'ask' | 'deny';
  };
}

// ============================================================
// Create Agent Config
// ============================================================

export interface CreateAgentConfig {
  /** LLM provider configuration */
  provider: ProviderConfig;
  /** Model ID to use (e.g. 'gpt-4o', 'claude-sonnet-4-20250514') */
  model: string;

  // ---- Prompt ----
  /** Custom system prompt appended to the base template */
  systemPrompt?: string;

  // ---- Tools ----
  /** Custom tools to register */
  tools?: UserToolDefinition[];
  /** MCP servers to connect */
  mcpServers?: SdkMcpServerConfig[];

  // ---- Capabilities (toggle managers on/off) ----
  /** Enable auto-memory (persisted to platform storage). Default: false */
  memory?: boolean;
  /** Enable plan management tools. Default: false */
  planning?: boolean;

  // ---- Permission ----
  /** Permission mode. Default: 'default' */
  permission?: PermissionMode;

  // ---- Hooks ----
  /** Lifecycle hooks to register */
  hooks?: Partial<Record<HookEvent, HookHandler>>;

  // ---- Skills ----
  /** Skills to register */
  skills?: SkillDefinition[];

  // ---- Advanced ----
  /** Context window configuration */
  contextConfig?: Partial<ContextConfig>;
  /** Maximum ReAct loop iterations. Default: 50 */
  maxIterations?: number;
  /** Working directory hint for tools. Default: '/' */
  workingDir?: string;
  /** Custom platform implementation. Default: BrowserPlatform */
  platform?: IPlatform;
}
