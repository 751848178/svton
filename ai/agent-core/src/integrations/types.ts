/**
 * Integration system type definitions.
 * Integrations provide external service connectivity (Slack, Linear, etc.)
 * either via direct API tools or MCP server templates.
 */

import type { ToolDefinition } from '../provider/types';
import type { IToolExecutor } from '../tool/types';

export type IntegrationCategory = 'comms' | 'issues' | 'docs' | 'general';
export type AuthType = 'api_key' | 'oauth' | 'none';

export interface AuthField {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
}

export interface IntegrationManifest {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  authType: AuthType;
  authFields: AuthField[];
  iconUrl?: string;
  /** MCP server template (if using MCP approach) */
  mcpServerTemplate?: { urlTemplate: string; type: 'http' | 'sse' };
  /** Returns tool definitions and executor factories for direct API approach */
  getTools?: (credentials: Record<string, string>) => Array<{
    definition: ToolDefinition;
    executor: IToolExecutor;
  }>;
}

export interface IntegrationConfig {
  id: string;
  enabled: boolean;
  credentials: Record<string, string>;
  addedAt: number;
}
