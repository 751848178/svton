import type { ISettingsAdapter, AgentData, ProviderInfo, ToolInfo, SkillInfo, SkillFormData, McpServerConfig, MemoryEntry } from '@svton/agent-ui';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { SkillLoader } from '@svton/agent-core';
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
      scope: (skill.scope || 'user') as 'user' | 'repo',
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
}
