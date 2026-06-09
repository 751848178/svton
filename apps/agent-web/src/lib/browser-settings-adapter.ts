import type { ISettingsAdapter, AgentData, ProviderInfo, ToolInfo, SkillInfo } from '@svton/agent-ui';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { initAgentConfig } from '@/lib/agent-setup';
import {
  loadSettings, saveSettings, loadJsonList, loadString, saveJson, saveString,
  type ProviderSetting,
  LS_DISABLED_TOOLS, LS_PERMISSION_MODE, LS_CUSTOM_INSTRUCTIONS,
  LS_DISABLED_SKILLS, LS_SEARCH_ENDPOINT, LS_DEFAULT_MODEL,
} from '@/lib/settings-store';

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
