/**
 * Plugin system types.
 *
 * A plugin bundles skills, MCP servers, and hooks into a single installable unit.
 * Manifest: `.svton-plugin/plugin.json` at the plugin root.
 */
import type { HookEvent } from '../hooks/types';

// ============================================================
// Plugin Manifest (.svton-plugin/plugin.json)
// ============================================================

export interface PluginManifest {
  /** Unique identifier, e.g. "svton-git-helper" */
  name: string;
  /** Semantic version */
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;

  /** Paths to SKILL.md files, relative to plugin root */
  skills?: string[];

  /** MCP servers bundled with this plugin */
  mcpServers?: PluginMcpServer[];

  /** Hook definitions */
  hooks?: PluginHook[];
}

export interface PluginMcpServer {
  /** Display name for this MCP server */
  name: string;
  transport: 'stdio' | 'http';
  /** Command to run (stdio only) */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Server URL (http only) */
  url?: string;
  enabled?: boolean;
  approvalMode?: 'auto' | 'ask' | 'deny';
}

export interface PluginHook {
  /** Lifecycle event to listen for */
  event: HookEvent;
  /** Description of what this hook does */
  description?: string;
}

// ============================================================
// Plugin Install Record (persisted in storage)
// ============================================================

export interface PluginInstallRecord {
  name: string;
  version: string;
  /** Where this plugin was installed from */
  source: 'local' | 'git' | 'url' | 'marketplace';
  sourceUrl?: string;
  installedAt: number;
  enabled: boolean;
  /** Local path where the plugin files reside */
  path?: string;
  /** Serialized PluginManifest */
  manifest: PluginManifest;
}
