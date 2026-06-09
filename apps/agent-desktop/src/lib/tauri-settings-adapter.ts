import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { SkillLoader } from '@svton/agent-core';
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

  constructor(platform: TauriPlatform, agentConfig?: AgentConfig, onUpdate?: () => void) {
    this.platform = platform;
    this._agentConfig = agentConfig;
    this.onUpdate = onUpdate;
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
        this._agentConfig?.capabilities?.permissionManager?.setMode?.(v as any);
      }
    }).catch(() => {});
    platform.storage.get<McpServerConfig[]>('agent:mcp_servers').then((v) => {
      if (Array.isArray(v)) this._mcpServers = v;
    }).catch(() => {});
  }

  setConfig(config: SvtonConfig | null) { this.config = config; }
  setAgentConfig(cfg: AgentConfig | undefined) { this._agentConfig = cfg; }

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
      scope: (skill.scope || 'user') as 'user' | 'repo',
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

  // ── Working Directory ────────────────────────────────────
  getWorkingDir(): string {
    return this._agentConfig?.workingDir || '';
  }

  async setWorkingDir(dir: string): Promise<void> {
    await this.platform.storage.set('agent:workingDir', dir);
    this.onUpdate?.();
  }

  // ── Platform info ────────────────────────────────────────
  async openInEditor(): Promise<void> {
    await openConfigInEditor(this.platform);
  }

  getStorageDescription(): string {
    return '桌面端配置存储在 ~/.svton/config.toml 文件中。也可使用 Cmd+, 快捷键在编辑器中打开。';
  }
}
