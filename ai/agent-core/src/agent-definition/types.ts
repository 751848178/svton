/**
 * Custom Agent Definition types.
 *
 * An AgentDefinition is a reusable configuration for an agent persona.
 * It can override the model, system prompt, tools, permissions, and more.
 * Sources include built-in defaults, user-defined, or project-level definitions.
 */

import type { SandboxMode } from '@svton/agent-platform';
import type { PermissionMode } from '../permission/types';

export type AgentDefinitionSource = 'builtin' | 'user' | 'project';

export interface AgentDefinition {
  /** Unique kebab-case key */
  name: string;
  /** Display name */
  title: string;
  description: string;
  /** Override default model */
  model?: string;
  /** Extra system prompt instructions */
  systemPrompt?: string;
  /** Tool allowlist (if set, only these tools are available) */
  tools?: string[];
  /** Tools to exclude */
  excludeTools?: string[];
  /** MCP servers to connect when this agent is active */
  mcpServers?: Array<{ name: string; url: string; type?: 'http' | 'sse' }>;
  /** Skill names to auto-enable */
  skills?: string[];
  /** Sandbox mode override */
  sandboxMode?: SandboxMode;
  /** Permission mode override */
  permissions?: PermissionMode;
  /** UI accent color */
  color?: string;
  /** Icon identifier or URL */
  icon?: string;
  /** Where this definition originated */
  source: AgentDefinitionSource;
}
