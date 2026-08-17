import type { McpServerConfig, McpServerInfo } from '../settings-data.types';

export interface McpMarketServer {
  id: string;
  qualifiedName: string;
  displayName: string;
  description: string;
  useCount: number;
  verified: boolean;
}

export interface McpSectionProps {
  servers: McpServerInfo[];
  configs: McpServerConfig[];
  onAdd?: (config: McpServerConfig) => void | Promise<void>;
  onRemove?: (name: string) => void | Promise<void>;
  onToggle?: (name: string, enabled: boolean) => void | Promise<void>;
  getMcpServerTools?: (serverName: string) => Promise<string[]>;
  updateMcpServerToolConfig?: (serverName: string, config: {
    approvalMode?: 'auto' | 'ask' | 'deny';
    enabledTools?: string[];
    disabledTools?: string[];
  }) => Promise<void>;
  searchMcpMarketplace?: (query: string) => Promise<{
    servers: McpMarketServer[];
    pagination: { totalCount: number };
  }>;
  installFromMcpMarketplace?: (qualifiedName: string) => Promise<{ success: boolean; error?: string }>;
  supportsStdio: boolean;
  onReload: () => void;
}
