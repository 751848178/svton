import type { ISettingsAdapter, AgentData, ProviderInfo, ToolInfo, SkillInfo, SkillFormData, McpServerConfig, MemoryEntry } from '@svton/agent-ui';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { SkillLoader, SkillInstaller, SkillMarketplace, McpMarketplace } from '@svton/agent-core';
import type { MarketplaceSkill } from '@svton/agent-core';
import { initAgentConfig } from '@/lib/agent-setup';
import {
  loadSettings, saveSettings, loadJsonList, loadString, saveJson, saveString,
  type ProviderSetting,
  LS_DISABLED_TOOLS, LS_PERMISSION_MODE, LS_CUSTOM_INSTRUCTIONS,
  LS_DISABLED_SKILLS, LS_SEARCH_ENDPOINT, LS_DEFAULT_MODEL,
} from '@/lib/settings-store';

const LS_MCP_SERVERS = 'agent-web:mcp_servers';

export class BrowserSettingsAdapter implements ISettingsAdapter {
  private _agentConfig: AgentConfig | null = null;
  private _platform: BrowserPlatform;
  private onUpdate?: () => void;
  private marketplace = new SkillMarketplace();

  constructor(platform: BrowserPlatform, onUpdate?: () => void) {
    this._platform = platform;
    this.onUpdate = onUpdate;
  }

  setAgentConfig(cfg: AgentConfig | null) { this._agentConfig = cfg; }

  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[] {
    return loadSettings().map((p) => ({
      id: p.id, name: p.name, type: p.type, baseUrl: p.baseUrl, apiKey: p.apiKey,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }));
  }

  setProviders(_providers: ProviderInfo[]): void {
    // No-op: web saves directly in saveProviders
  }

  async saveProviders(providers: ProviderInfo[]): Promise<void> {
    const existing = loadSettings();
    const updated = providers.map((info, i) => {
      const orig = existing[i] || existing.find((p) => p.id === info.id);
      return {
        ...orig,
        id: info.id,
        name: info.name,
        type: (info.type === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic',
        baseUrl: info.baseUrl,
        apiKey: info.apiKey,
        models: info.models,
      } as ProviderSetting;
    });
    saveSettings(updated);
  }

  // ── Model selection ──────────────────────────────────────
  getDefaultModel(): string {
    return loadString(LS_DEFAULT_MODEL) || '';
  }

  setDefaultModel(key: string): void {
    saveString(LS_DEFAULT_MODEL, key);
  }

  // ── Agent runtime ────────────────────────────────────────
  getAgentData(): AgentData | null {
    if (!this._agentConfig) return null;
    const cfg = this._agentConfig;
    const tools: ToolInfo[] = cfg.toolRegistry?.listDefinitions() ?? [];
    const skills: SkillInfo[] = cfg.capabilities?.skillManager?.list() ?? [];
    return {
      tools: tools as ToolInfo[],
      skills: skills as SkillInfo[],
      permissionMode: cfg.capabilities?.permissionManager?.getMode?.() ?? 'default',
      hasMemory: cfg.capabilities?.memoryManager?.hasMemory ?? false,
      memoryText: cfg.capabilities?.memoryManager?.getAllMemoryText?.() ?? '',
      mcpServers: [],
      hasSubagent: !!cfg.capabilities?.subagentManager,
      hasPlanning: !!cfg.capabilities?.planningManager,
    };
  }

  async reloadAgent(): Promise<void> {
    const cfg = await initAgentConfig(undefined, this._platform);
    this._agentConfig = cfg;
    this.onUpdate?.();
  }

  // ── Personalization ──────────────────────────────────────
  getCustomInstructions(): string {
    return loadString(LS_CUSTOM_INSTRUCTIONS);
  }

  async saveCustomInstructions(text: string): Promise<void> {
    saveString(LS_CUSTOM_INSTRUCTIONS, text);
  }

  // ── Permission mode ──────────────────────────────────────
  getPermissionMode(): string {
    return loadString(LS_PERMISSION_MODE) || 'default';
  }

  savePermissionMode(mode: string): void {
    saveString(LS_PERMISSION_MODE, mode);
  }

  // ── Tool / skill toggles ─────────────────────────────────
  getDisabledTools(): string[] {
    return loadJsonList(LS_DISABLED_TOOLS);
  }

  saveDisabledTools(names: string[]): void {
    saveJson(LS_DISABLED_TOOLS, names);
  }

  getDisabledSkills(): string[] {
    return loadJsonList(LS_DISABLED_SKILLS);
  }

  saveDisabledSkills(names: string[]): void {
    saveJson(LS_DISABLED_SKILLS, names);
  }

  // ── Memory ───────────────────────────────────────────────
  async addMemory(text: string): Promise<void> {
    if (!text.trim() || !this._agentConfig?.capabilities?.memoryManager) return;
    await this._agentConfig.capabilities.memoryManager.saveAutoMemory(text.trim(), 'user_note');
  }

  async clearMemory(): Promise<void> {
    if (!this._agentConfig?.capabilities?.memoryManager) return;
    await this._agentConfig.capabilities.memoryManager.clearAutoMemory();
  }

  getMemoryEntries(): MemoryEntry[] {
    if (!this._agentConfig?.capabilities?.memoryManager) return [];
    return this._agentConfig.capabilities.memoryManager.getAllEntries().map((e: any) => ({
      key: e.key,
      content: e.content,
      source: e.source || '',
      timestamp: e.timestamp,
    }));
  }

  async deleteMemoryEntry(key: string): Promise<void> {
    if (!this._agentConfig?.capabilities?.memoryManager) return;
    await this._agentConfig.capabilities.memoryManager.deleteEntry(key);
  }

  // ── Skills CRUD ──────────────────────────────────────────
  async addSkill(skill: SkillFormData): Promise<void> {
    const def = {
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      scope: (skill.scope || 'user') as 'user' | 'project',
    };
    await SkillLoader.saveToStorage(this._platform.storage, def);
    this._agentConfig?.capabilities?.skillManager?.register(def);
  }

  async updateSkill(name: string, updates: SkillFormData): Promise<void> {
    await this.deleteSkill(name);
    await this.addSkill(updates);
  }

  async deleteSkill(name: string): Promise<void> {
    await SkillLoader.removeFromStorage(this._platform.storage, name);
    this._agentConfig?.capabilities?.skillManager?.unregister(name);
    const disabled = loadJsonList(LS_DISABLED_SKILLS).filter((s) => s !== name);
    saveJson(LS_DISABLED_SKILLS, disabled);
  }

  // ── MCP Server CRUD (HTTP only) ──────────────────────────
  getMcpServerConfigs(): McpServerConfig[] {
    try {
      return JSON.parse(localStorage.getItem(LS_MCP_SERVERS) || '[]');
    } catch { return []; }
  }

  async addMcpServer(config: McpServerConfig): Promise<void> {
    const servers = this.getMcpServerConfigs();
    servers.push({ ...config, transport: 'http' }); // Force HTTP for web
    localStorage.setItem(LS_MCP_SERVERS, JSON.stringify(servers));
  }

  async removeMcpServer(name: string): Promise<void> {
    const servers = this.getMcpServerConfigs().filter((s) => s.name !== name);
    localStorage.setItem(LS_MCP_SERVERS, JSON.stringify(servers));
  }

  async toggleMcpServer(name: string, enabled: boolean): Promise<void> {
    const servers = this.getMcpServerConfigs().map((s) =>
      s.name === name ? { ...s, enabled } : s,
    );
    localStorage.setItem(LS_MCP_SERVERS, JSON.stringify(servers));
  }

  async getMcpServerTools(serverName: string): Promise<string[]> {
    const clients = this._agentConfig?.capabilities?.mcpClients ?? [];
    const client = clients.find((c) => c.info?.name === serverName);
    if (!client || !client.connected) return [];
    try {
      const tools = await client.listTools();
      return tools.map((t) => t.name);
    } catch {
      return [];
    }
  }

  async updateMcpServerToolConfig(
    serverName: string,
    config: { approvalMode?: 'auto' | 'ask' | 'deny'; enabledTools?: string[]; disabledTools?: string[] },
  ): Promise<void> {
    const servers = this.getMcpServerConfigs().map((s) =>
      s.name === serverName ? { ...s, ...config } : s,
    );
    localStorage.setItem(LS_MCP_SERVERS, JSON.stringify(servers));
  }

  // ── Platform info ────────────────────────────────────────
  getStorageDescription(): string {
    return 'Web 版设置存储在浏览器 localStorage 中。清除浏览器数据会重置所有配置。';
  }

  // ── Web search ───────────────────────────────────────────
  getSearchEndpoint(): string {
    return loadString(LS_SEARCH_ENDPOINT);
  }

  saveSearchEndpoint(url: string): void {
    if (url.trim()) saveString(LS_SEARCH_ENDPOINT, url.trim());
    else if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_SEARCH_ENDPOINT);
  }

  // ── Skill Installation (Web: URL only) ───────────────────
  async installSkillFromUrl(url: string): Promise<{ success: boolean; error?: string }> {
    const installer = new SkillInstaller(this._platform.storage);
    const result = await installer.installFromUrl(url);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  supportsAdvancedInstall(): boolean {
    return false;
  }

  // ── Skill Marketplace (skills.sh) ──────────────────────
  async searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
    const remote = await this.marketplace.search(query, 20);
    return this.marketplace.toMarketplaceSkills(remote, this._platform.storage);
  }

  async browseMarketplace(options?: { view?: string; page?: number }): Promise<{ skills: MarketplaceSkill[]; total: number }> {
    const result = await this.marketplace.list({
      view: (options?.view as 'all-time' | 'trending' | 'hot') || 'trending',
      page: options?.page ?? 0,
      perPage: 20,
    });
    const skills = await this.marketplace.toMarketplaceSkills(result.skills, this._platform.storage);
    return { skills, total: result.total };
  }

  async installFromMarketplace(skillId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.marketplace.install(skillId, this._platform.storage);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  // ── MCP Marketplace (Smithery) ───────────────────────────
  private mcpMarketplace = new McpMarketplace();

  async searchMcpMarketplace(query: string): Promise<{ servers: Array<{ id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }>; pagination: { totalCount: number } }> {
    const result = await this.mcpMarketplace.search(query);
    return {
      servers: result.servers.map((s: { id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }) => ({
        id: s.id,
        qualifiedName: s.qualifiedName,
        displayName: s.displayName,
        description: s.description,
        useCount: s.useCount,
        verified: s.verified,
      })),
      pagination: { totalCount: result.pagination.totalCount },
    };
  }

  async installFromMcpMarketplace(qualifiedName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.mcpMarketplace.install(qualifiedName, this._platform.storage);
      this.onUpdate?.();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Install failed' };
    }
  }
}
