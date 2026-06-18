/**
 * @svton/agent-app — Type definitions
 */

import type { AgentConfig, BuiltinIntegrationId, IProvider, IntegrationManifest } from '@svton/agent-core';
import type { SplitScreenContent, SidebarConfig, SidebarItem } from '@svton/agent-ui';

// ============================================================
// Provider Configuration
// ============================================================

export interface ProviderConfig {
  type: 'openai' | 'anthropic' | (string & {});
  apiKey?: string;
  baseUrl?: string;
  name?: string;
  models: ModelConfig[];
  /** Prebuilt provider instance. Takes precedence over type/baseUrl/apiKey. */
  provider?: IProvider;
  /** Factory for custom provider types. */
  createProvider?: (config: ProviderConfig, models: import('@svton/agent-core').ModelInfo[]) => IProvider;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  supportsToolUse?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  supportsThinking?: boolean;
}

// ============================================================
// Feature Flags
// ============================================================

export interface FeatureFlags {
  /** Web fetch tool (default: true) */
  webFetch?: boolean;
  /** Memory tools and memory manager (default: true) */
  memory?: boolean;
  /** Planning tools and planning manager (default: true) */
  planning?: boolean;
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
  /** Plugin manager and plugin-provided MCP/skills (default: true) */
  plugins?: boolean;
  /** Built-in/direct integrations (default: true) */
  integrations?: boolean;
}

export interface ImageProviderConfig {
  /** Stability AI API key for image generation */
  stabilityKey?: string;
  /** Google Imagen API key for image generation */
  googleKey?: string;
}

export interface SettingsPersistenceConfig {
  /**
   * Provider config source.
   * - persisted: read/write providers from AgentApp storage, seeded from props on first use.
   * - controlled: always use providers prop; settings edits are not persisted as runtime provider source.
   * - merge: merge props with persisted providers by id/name, preferring persisted user edits.
   */
  mode?: 'persisted' | 'controlled' | 'merge';
  /** Persist provider API keys saved from Settings into localStorage. Default: true. */
  persistProviderSecrets?: boolean;
  /** Seed provider API keys from the initial providers prop into localStorage. Default: false. */
  persistInitialProviderSecrets?: boolean;
}

export interface StorageConfig {
  /** Prefix for browser localStorage keys. Default: "svton-app". */
  namespace?: string;
}

export interface IntegrationConfig {
  /** Enable integration manager and settings UI integration cards. Default: true. */
  enabled?: boolean;
  /** Built-in integrations to expose. Default: ["slack", "linear"]. */
  builtin?: BuiltinIntegrationId[];
  /** Additional integration manifests supplied by the host app. */
  manifests?: IntegrationManifest[];
}

export interface MarketplaceConfig {
  /** Enable skill marketplace access in settings. Default: true. */
  skills?: boolean;
  /** Enable MCP marketplace access in settings. Default: true. */
  mcp?: boolean;
  /** Skill marketplace page size. Default: 20. */
  pageSize?: number;
  /** Skill marketplace default view. Default: "trending". */
  defaultSkillView?: 'all-time' | 'trending' | 'hot';
}

export interface RuntimeConfig {
  /**
   * Explicit runtime key. Change it when host-controlled runtime inputs change
   * and the chat runtime must be recreated.
   */
  key?: string;
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
  /** Optional image generation provider keys beyond OpenAI */
  imageProviders?: ImageProviderConfig;
  /** Controls how AgentApp stores and reads provider settings */
  settings?: SettingsPersistenceConfig;
  /** Browser storage namespace */
  storage?: StorageConfig;
  /** Integration registry configuration */
  integrations?: IntegrationConfig;
  /** Skill/MCP marketplace behavior */
  marketplace?: MarketplaceConfig;
  /** Runtime recreation behavior */
  runtime?: RuntimeConfig;
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
  /** Sidebar configuration */
  sidebarConfig?: Partial<SidebarConfig>;
  /** Extra sidebar nav items */
  sidebarItems?: SidebarItem[];
  /** Theme. Only dark is currently implemented; light will be exposed once tokens are complete. */
  theme?: 'dark';
}

export interface McpServerEntry {
  name: string;
  url: string;
  type?: 'http' | 'sse';
  enabled?: boolean;
  headers?: Record<string, string>;
  approvalMode?: 'auto' | 'ask' | 'deny';
  enabledTools?: string[];
  disabledTools?: string[];
}

// ============================================================
// Internal types
// ============================================================

export type View = 'chat' | 'settings';

export interface ModelOption {
  key: string;
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  providerType: string;
}
