import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { SkillLoader, SkillInstaller, SkillMarketplace, McpMarketplace } from '@svton/agent-core';
import type { MarketplaceSkill } from '@svton/agent-core';
import {
  type ISettingsAdapter,
  type AgentData,
  type ProviderInfo,
  type ToolInfo,
  type SkillInfo,
  type McpServerInfo,
  type SkillFormData,
  type McpServerConfig,
  type MemoryEntry,
  type IntegrationCardData,
} from '@svton/agent-ui';
import {
  loadConfig,
  saveConfig,
  openConfigInEditor,
  type SvtonConfig,
} from '@/lib/config-store';

export class TauriSettingsAdapter implements ISettingsAdapter {
  private config: SvtonConfig | null = null;
  private _agentConfig: AgentConfig | undefined;
  private platform: TauriPlatform;
  private onUpdate?: () => void;
  private _disabledTools: string[] = [];
  private _disabledSkills: string[] = [];
  private _customInstructions: string = '';
  private _permissionMode: string = 'default';
  private _mcpServers: McpServerConfig[] = [];
  private marketplace = new SkillMarketplace();

  private onReinit?: (workingDir?: string) => void;

  constructor(platform: TauriPlatform, agentConfig?: AgentConfig, onUpdate?: () => void, onReinit?: (workingDir?: string) => void) {
    this.platform = platform;
    this._agentConfig = agentConfig;
    this.onUpdate = onUpdate;
    this.onReinit = onReinit;
    // Load persisted values from storage
    platform.storage.get<string[]>('agent:disabled_tools').then((v) => {
      if (Array.isArray(v)) this._disabledTools = v;
    }).catch(() => {});
    platform.storage.get<string[]>('agent:disabled_skills').then((v) => {
      if (Array.isArray(v)) this._disabledSkills = v;
    }).catch(() => {});
    platform.storage.get<string>('desktop:customInstructions').then((v) => {
      if (typeof v === 'string') this._customInstructions = v;
    }).catch(() => {});
    platform.storage.get<string>('agent:permission_mode').then((v) => {
      if (v) {
        this._permissionMode = v;
        // NOTE: Do NOT call setMode() here — the PermissionManager is already
        // initialized with the correct mode in agent-setup.ts. Calling setMode()
        // here would race with MainLayout's own initialization and could override
        // the user's explicit mode choice with a stale stored value.
      }
    }).catch(() => {});
    platform.storage.get<McpServerConfig[]>('agent:mcp_servers').then((v) => {
      if (Array.isArray(v)) this._mcpServers = v;
    }).catch(() => {});
  }

  setConfig(config: SvtonConfig | null) { this.config = config; }
  setAgentConfig(cfg: AgentConfig | undefined) { this._agentConfig = cfg; }

  private _integrationManager: any = null;
  setIntegrationManager(mgr: any) { this._integrationManager = mgr; }

  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[] {
    if (!this.config) return [];
    return Object.entries(this.config.providers).map(([name, p]) => ({
      id: name,
      name,
      type: p.type,
      baseUrl: p.base_url,
      apiKey: p.api_key,
      models: Object.entries(p.models || {}).map(([id, displayName]) => ({
        id,
        name: displayName || id,
      })),
    }));
  }

  setProviders(providers: ProviderInfo[]): void {
    if (!this.config) return;
    const map: SvtonConfig['providers'] = {};
    for (const p of providers) {
      const models: Record<string, string> = {};
      for (const m of p.models) models[m.id] = m.name;
      const existing = this.config.providers[p.name] || this.config.providers[p.id];
      map[p.name] = {
        type: (existing?.type || p.type) as 'openai' | 'anthropic',
        base_url: p.baseUrl,
        api_key: p.apiKey,
        models,
      };
    }
    this.config = { ...this.config, providers: map };
    this.onUpdate?.();
  }

  async saveProviders(providers: ProviderInfo[]): Promise<void> {
    this.setProviders(providers);
    if (this.config) await saveConfig(this.platform, this.config);
  }

  // ── Model selection ──────────────────────────────────────
  getDefaultModel(): string {
    if (!this.config) return '';
    return `${this.config.model.provider}::${this.config.model.name}`;
  }

  setDefaultModel(key: string): void {
    if (!this.config) return;
    const [provider, ...rest] = key.split('::');
    this.config = {
      ...this.config,
      model: { provider, name: rest.join('::') },
    };
    this.onUpdate?.();
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
      mcpServers: (cfg.capabilities?.mcpClients ?? []).map((c: any) => ({
        name: c.serverInfo?.name || 'Unknown',
      })) as McpServerInfo[],
      hasSubagent: !!cfg.capabilities?.subagentManager,
      hasPlanning: !!cfg.capabilities?.planningManager,
    };
  }

  async reloadAgent(): Promise<void> {
    this.onUpdate?.();
  }

  // ── Personalization ──────────────────────────────────────
  getCustomInstructions(): string {
    return this._customInstructions;
  }

  async saveCustomInstructions(text: string): Promise<void> {
    this._customInstructions = text;
    await this.platform.storage.set('desktop:customInstructions', text);
  }

  // ── Permission mode ──────────────────────────────────────
  getPermissionMode(): string {
    return this._permissionMode;
  }

  savePermissionMode(mode: string): void {
    this._permissionMode = mode;
    this._agentConfig?.capabilities?.permissionManager?.setMode?.(mode as any);
    this.platform.storage.set('agent:permission_mode', mode).catch(() => {});
  }

  // ── Tool / skill toggles ─────────────────────────────────
  getDisabledTools(): string[] { return this._disabledTools; }
  saveDisabledTools(names: string[]): void {
    this._disabledTools = names;
    this.platform.storage.set('agent:disabled_tools', names).catch(() => {});
  }
  getDisabledSkills(): string[] { return this._disabledSkills; }
  saveDisabledSkills(names: string[]): void {
    this._disabledSkills = names;
    this.platform.storage.set('agent:disabled_skills', names).catch(() => {});
  }

  // ── Memory ───────────────────────────────────────────────
  async addMemory(text: string): Promise<void> {
    if (!this._agentConfig?.capabilities?.memoryManager || !text.trim()) return;
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
    await SkillLoader.saveToStorage(this.platform.storage, def);
    this._agentConfig?.capabilities?.skillManager?.register(def);
  }

  async updateSkill(name: string, updates: SkillFormData): Promise<void> {
    await this.deleteSkill(name);
    await this.addSkill(updates);
  }

  async deleteSkill(name: string): Promise<void> {
    await SkillLoader.removeFromStorage(this.platform.storage, name);
    this._agentConfig?.capabilities?.skillManager?.unregister(name);
    this._disabledSkills = this._disabledSkills.filter((s) => s !== name);
    await this.platform.storage.set('agent:disabled_skills', this._disabledSkills);
  }

  // ── MCP Server CRUD ──────────────────────────────────────
  getMcpServerConfigs(): McpServerConfig[] {
    return this._mcpServers;
  }

  async addMcpServer(config: McpServerConfig): Promise<void> {
    this._mcpServers = [...this._mcpServers, config];
    await this.platform.storage.set('agent:mcp_servers', this._mcpServers);
  }

  async removeMcpServer(name: string): Promise<void> {
    this._mcpServers = this._mcpServers.filter((s) => s.name !== name);
    await this.platform.storage.set('agent:mcp_servers', this._mcpServers);
    // Unregister MCP tools from registry
    const registry = this._agentConfig?.toolRegistry;
    if (registry) {
      const prefix = `mcp__${name}__`;
      for (const tool of registry.listDefinitions()) {
        if (tool.name.startsWith(prefix)) {
          registry.unregister(tool.name);
        }
      }
    }
  }

  async toggleMcpServer(name: string, enabled: boolean): Promise<void> {
    this._mcpServers = this._mcpServers.map((s) =>
      s.name === name ? { ...s, enabled } : s,
    );
    await this.platform.storage.set('agent:mcp_servers', this._mcpServers);
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
    this._mcpServers = this._mcpServers.map((s) =>
      s.name === serverName ? { ...s, ...config } : s,
    );
    await this.platform.storage.set('agent:mcp_servers', this._mcpServers);
  }

  // ── Working Directory ────────────────────────────────────
  getWorkingDir(): string {
    return this._agentConfig?.workingDir || '';
  }

  async setWorkingDir(dir: string): Promise<void> {
    await this.platform.storage.set('agent:workingDir', dir);
    // Update in-memory config for immediate UI feedback
    if (this._agentConfig) {
      this._agentConfig.workingDir = dir;
    }
    this.onUpdate?.();
    // Trigger full agent re-initialization with new working directory
    this.onReinit?.(dir);
  }

  // ── Platform info ────────────────────────────────────────
  async openInEditor(): Promise<void> {
    await openConfigInEditor(this.platform);
  }

  getStorageDescription(): string {
    return '桌面端配置存储在 ~/.svton/config.toml 文件中。也可使用 Cmd+, 快捷键在编辑器中打开。';
  }

  // ── Skill Installation ───────────────────────────────────
  async installSkillFromUrl(url: string): Promise<{ success: boolean; error?: string }> {
    const installer = new SkillInstaller(this.platform.storage, this.platform);
    const result = await installer.installFromUrl(url);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  async installSkillFromGit(repo: string): Promise<{ success: boolean; error?: string }> {
    const installer = new SkillInstaller(this.platform.storage, this.platform);
    const result = await installer.installFromGit(repo);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  async installSkillFromLocal(path: string): Promise<{ success: boolean; error?: string }> {
    const installer = new SkillInstaller(this.platform.storage, this.platform);
    const result = await installer.installFromLocalDir(path);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  supportsAdvancedInstall(): boolean {
    return true;
  }

  // ── Skill Marketplace (skills.sh) ──────────────────────
  async searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
    const remote = await this.marketplace.search(query, 20);
    return this.marketplace.toMarketplaceSkills(remote, this.platform.storage);
  }

  async browseMarketplace(options?: { view?: string; page?: number }): Promise<{ skills: MarketplaceSkill[]; total: number }> {
    const result = await this.marketplace.list({
      view: (options?.view as 'all-time' | 'trending' | 'hot') || 'trending',
      page: options?.page ?? 0,
      perPage: 20,
    });
    const skills = await this.marketplace.toMarketplaceSkills(result.skills, this.platform.storage);
    return { skills, total: result.total };
  }

  async installFromMarketplace(skillId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.marketplace.install(skillId, this.platform.storage);
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
      await this.mcpMarketplace.install(qualifiedName, this.platform.storage);
      this.onUpdate?.();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Install failed' };
    }
  }

  // ── Sandbox ─────────────────────────────────────────────
  getSandboxConfig(): { enabled: boolean; mode: string } {
    const caps = this._agentConfig?.capabilities;
    const hasSandbox = !!this.platform.capabilities.sandboxing && !!this.platform.sandbox;
    return { enabled: hasSandbox, mode: 'workspace_write' };
  }

  saveSandboxConfig(config: { enabled: boolean; mode: string }): void {
    // Persist sandbox mode preference; actual enforcement is via runtime autoReviewer + sandbox profile
    this.platform.storage.set('agent:sandbox_config', config).catch(() => {});
  }

  // ── Auto-reviewer ───────────────────────────────────────
  getAutoReviewerConfig(): { mode: string; rules: Array<{ id: string; description: string; verdict: string }> } {
    const reviewer = this._agentConfig?.capabilities?.autoReviewer;
    if (!reviewer) return { mode: 'manual', rules: [] };
    const rules = reviewer.listRules().map(r => ({ id: r.id, description: r.description, verdict: r.verdict }));
    return { mode: reviewer.getMode(), rules };
  }

  saveAutoReviewerMode(mode: string): void {
    const reviewer = this._agentConfig?.capabilities?.autoReviewer;
    if (reviewer) {
      reviewer.setMode(mode as 'auto_review' | 'manual');
    }
    this.platform.storage.set('agent:auto_reviewer_mode', mode).catch(() => {});
  }

  // ── Integrations ────────────────────────────────────────
  getIntegrations(): IntegrationCardData[] {
    if (!this._integrationManager) return [];
    try {
      return this._integrationManager.list().map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        enabled: m.enabled,
        credentials: m.credentials || {},
        credentialFields: m.credentialFields || [],
      }));
    } catch { return []; }
  }

  async toggleIntegration(id: string, enabled: boolean): Promise<void> {
    if (!this._integrationManager) return;
    try {
      if (enabled) await this._integrationManager.enable(id);
      else await this._integrationManager.disable(id);
      this.onUpdate?.();
    } catch {}
  }

  async setIntegrationCredential(id: string, key: string, value: string): Promise<void> {
    if (!this._integrationManager) return;
    try {
      await this._integrationManager.setCredential(id, key, value);
    } catch {}
  }
}
