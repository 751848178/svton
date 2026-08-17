import type { IntegrationCardData } from './IntegrationsPanel';
import type { McpServerConfig, MemoryEntry, MarketplaceSkill, ProviderInfo, SkillFormData, ToolInfo, SkillInfo, McpServerInfo } from './settings-data.types';

export interface ISettingsAdapter {
  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[];
  setProviders(providers: ProviderInfo[]): void;
  saveProviders(providers: ProviderInfo[]): void | Promise<void>;

  // ── Model selection ──────────────────────────────────────
  getDefaultModel(): string;
  setDefaultModel(key: string): Promise<void>;

  // ── Agent runtime (tools, skills, memory, etc.) ─────────
  /** Return null if agent is not yet initialized (e.g. no API key) */
  getAgentData(): AgentData | null;
  /** Reload agent after config changes (e.g. memory add/clear) */
  reloadAgent(): void | Promise<void>;

  // ── Personalization ──────────────────────────────────────
  getCustomInstructions(): string;
  saveCustomInstructions(text: string): void | Promise<void>;

  // ── Permission mode ──────────────────────────────────────
  getPermissionMode(): string;
  savePermissionMode(mode: string): Promise<void>;

  // ── Tool / skill toggles ─────────────────────────────────
  getDisabledTools(): string[];
  saveDisabledTools(names: string[]): void;
  getDisabledSkills(): string[];
  saveDisabledSkills(names: string[]): void;

  // ── Memory ───────────────────────────────────────────────
  addMemory(text: string): void | Promise<void>;
  clearMemory(): void | Promise<void>;
  getMemoryEntries?(): MemoryEntry[];
  deleteMemoryEntry?(key: string): void | Promise<void>;

  // ── Sandbox ─────────────────────────────────────────────
  getSandboxConfig?(): { enabled: boolean; mode: string };
  saveSandboxConfig?(config: { enabled: boolean; mode: string }): void;

  // ── Auto-reviewer ───────────────────────────────────────
  getAutoReviewerConfig?(): { mode: string; rules: Array<{ id: string; description: string; verdict: string }> };
  saveAutoReviewerMode?(mode: string): void;

  // ── Skills CRUD ──────────────────────────────────────────
  addSkill?(skill: SkillFormData): void | Promise<void>;
  updateSkill?(name: string, updates: SkillFormData): void | Promise<void>;
  deleteSkill?(name: string): void | Promise<void>;

  // ── Skill Installation ────────────────────────────────────
  installSkillFromUrl?(url: string): Promise<{ success: boolean; error?: string }>;
  installSkillFromGit?(repo: string): Promise<{ success: boolean; error?: string }>;
  installSkillFromLocal?(path: string): Promise<{ success: boolean; error?: string }>;
  getInstalledSkills?(): Array<{ name: string; source: string; installedAt: number }>;
  /** Whether the platform supports git/local installation (desktop only) */
  supportsAdvancedInstall?(): boolean;

  // ── Skill Marketplace (skills.sh) ──────────────────────
  searchMarketplace?(query: string): Promise<MarketplaceSkill[]>;
  browseMarketplace?(options?: { view?: string; page?: number }): Promise<{ skills: MarketplaceSkill[]; total: number }>;
  installFromMarketplace?(skillId: string): Promise<{ success: boolean; error?: string }>;

  // ── MCP Server CRUD ──────────────────────────────────────
  getMcpServerConfigs?(): McpServerConfig[];
  addMcpServer?(config: McpServerConfig): void | Promise<void>;
  removeMcpServer?(name: string): void | Promise<void>;
  toggleMcpServer?(name: string, enabled: boolean): void | Promise<void>;
  getMcpServerTools?(serverName: string): Promise<string[]>;
  updateMcpServerToolConfig?(serverName: string, config: {
    approvalMode?: 'auto' | 'ask' | 'deny';
    enabledTools?: string[];
    disabledTools?: string[];
  }): Promise<void>;

  // ── MCP Marketplace (Smithery) ───────────────────────────
  searchMcpMarketplace?(query: string): Promise<{ servers: Array<{ id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }>; pagination: { totalCount: number } }>;
  installFromMcpMarketplace?(qualifiedName: string): Promise<{ success: boolean; error?: string }>;

  // ── Platform info ────────────────────────────────────────
  getWorkingDir?(): string;
  setWorkingDir?(dir: string): void | Promise<void>;
  openInEditor?(): void | Promise<void>;
  getStorageDescription(): string;

  // ── Optional: web search ─────────────────────────────────
  getSearchEndpoint?(): string;
  saveSearchEndpoint?(url: string): void;
  /** Tavily API key for the hosted web_search backend (tvly-...). */
  getSearchApiKey?(): string;
  saveSearchApiKey?(key: string): void;
  getPreviewMode?(): 'sidebar' | 'window';
  savePreviewMode?(mode: 'sidebar' | 'window'): void;

  // ── Integrations ────────────────────────────────────────
  getIntegrations?(): IntegrationCardData[];
  toggleIntegration?(id: string, enabled: boolean): void | Promise<void>;
  setIntegrationCredential?(id: string, key: string, value: string): void | Promise<void>;

  // ── Hooks ───────────────────────────────────────────────
  getHooks?(): Array<{ event: string; id: string; priority: number }>;
  unregisterHook?(event: string, id: string): void;

  // ── Session Checkpoints ─────────────────────────────────
  listCheckpoints?(): Promise<Array<{ sessionId: string; messageCount: number; model: string; updatedAt: number }>>;
  deleteCheckpoint?(sessionId: string): Promise<void>;
}
/** Agent runtime data exposed by the adapter */
export interface AgentData {
  tools: ToolInfo[];
  skills: SkillInfo[];
  permissionMode: string;
  hasMemory: boolean;
  memoryText: string;
  mcpServers: McpServerInfo[];
  hasSubagent: boolean;
  hasPlanning: boolean;
}
