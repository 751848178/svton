export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  models: Array<{ id: string; name: string }>;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: any;
  annotations?: any;
}

export interface SkillInfo {
  name: string;
  description: string;
  scope?: string;
  trigger?: { type: string };
  requiredTools?: string[];
}

export interface McpServerInfo {
  name: string;
  tools?: string[];
  connected?: boolean;
}

// ── CRUD data types ──

export interface SkillFormData {
  name: string;
  description: string;
  instructions: string;
  scope?: 'user' | 'repo';
}

export interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  /** Per-server tool approval mode */
  approvalMode?: 'auto' | 'ask' | 'deny';
  /** Tool names explicitly enabled (empty/undefined = all) */
  enabledTools?: string[];
  /** Tool names explicitly disabled */
  disabledTools?: string[];
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  source: string;
  installs: number;
  url: string;
  installed: boolean;
}

export interface MemoryEntry {
  key: string;
  content: string;
  source: string;
  timestamp?: number;
}

// ════════════════════════════════════════════════════════════
