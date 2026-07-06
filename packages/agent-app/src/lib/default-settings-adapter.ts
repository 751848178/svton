/**
 * Default browser settings adapter for AgentApp.
 * Persists simple app settings in localStorage and runtime data in BrowserPlatform storage.
 */

import type {
  ISettingsAdapter,
  AgentData,
  ProviderInfo,
  McpServerConfig,
  SkillFormData,
  MemoryEntry,
  IntegrationCardData,
} from '@svton/agent-ui';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentConfig, MarketplaceSkill } from '@svton/agent-core';
import {
  McpMarketplace,
  SkillInstaller,
  SkillLoader,
  SkillMarketplace,
} from '@svton/agent-core';
import type { IntegrationConfig, MarketplaceConfig, McpServerEntry, ProviderConfig, SettingsPersistenceConfig } from '../types';
import { createAgentAppStorage, type AgentAppStorage } from './storage';
import { resolveAgentAppIntegrationManifests } from './integrations';
import { ProviderSettingsStore } from './provider-settings-store';
import { IntegrationSettingsStore } from './integration-settings-store';

const LS = {
  defaultModel: 'defaultModel',
  customInstructions: 'customInstructions',
  permissionMode: 'permissionMode',
  disabledTools: 'disabledTools',
  disabledSkills: 'disabledSkills',
  searchEndpoint: 'searchEndpoint',
  searchApiKey: 'searchApiKey',
  previewMode: 'previewMode',
  mcpServers: 'mcpServers',
  memory: 'memory',
};

export class DefaultSettingsAdapter implements ISettingsAdapter {
  private _agentData: AgentData | null = null;
  private _agentConfig: AgentConfig | null = null;
  private marketplace = new SkillMarketplace();
  private mcpMarketplace = new McpMarketplace();
  private storage: AgentAppStorage;
  private providerStore: ProviderSettingsStore;
  private integrationStore: IntegrationSettingsStore;
  onUpdate?: () => void;

  constructor(
    initialProviders: ProviderConfig[],
    private platform: BrowserPlatform,
    settings: SettingsPersistenceConfig = {},
    storageNamespace?: string,
    integrations: IntegrationConfig = {},
    private marketplaceConfig: MarketplaceConfig = {},
  ) {
    this.storage = createAgentAppStorage(storageNamespace);
    this.providerStore = new ProviderSettingsStore(initialProviders, this.storage, settings);
    const integrationManifests = resolveAgentAppIntegrationManifests(integrations);
    this.integrationStore = new IntegrationSettingsStore(platform, this.storage, integrationManifests);
    this.hydrateIntegrationMirror().catch(() => {});
  }

  getStorageDescription(): string {
    return 'localStorage + IndexedDB (browser)';
  }

  setAgentData(data: AgentData | null): void {
    this._agentData = data;
  }

  setAgentConfig(config: AgentConfig | null): void {
    this._agentConfig = config;
  }

  getProviderConfigs(): ProviderConfig[] {
    return this.providerStore.getProviderConfigs();
  }

  getMcpServerEntries(): McpServerEntry[] {
    return this.getMcpServerConfigs()
      .filter((s) => s.transport === 'http' && !!s.url)
      .map((s) => ({
        name: s.name,
        url: s.url!,
        type: 'http',
        enabled: s.enabled,
        approvalMode: s.approvalMode,
        enabledTools: s.enabledTools,
        disabledTools: s.disabledTools,
      }));
  }

  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[] {
    return this.providerStore.getProviders();
  }

  setProviders(providers: ProviderInfo[]): void {
    this.providerStore.setProviders(providers);
  }

  saveProviders(providers: ProviderInfo[]): void {
    this.providerStore.saveProviders(providers);
    this.onUpdate?.();
  }

  // ── Model ────────────────────────────────────────────────
  getDefaultModel(): string {
    return this.storage.getString(LS.defaultModel);
  }

  setDefaultModel(key: string): void {
    this.storage.setString(LS.defaultModel, key);
    this.onUpdate?.();
  }

  // ── Agent data ───────────────────────────────────────────
  getAgentData(): AgentData | null {
    if (!this._agentConfig) return this._agentData;
    const cfg = this._agentConfig;
    const clients = cfg.capabilities?.mcpClients ?? [];
    return {
      tools: cfg.toolRegistry.listDefinitions().map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        annotations: t.annotations,
      })),
      skills: (cfg.capabilities?.skillManager?.list() ?? []).map((s) => ({
        name: s.name,
        description: s.description,
        scope: s.scope,
        trigger: s.trigger,
        requiredTools: s.requiredTools,
      })),
      permissionMode: cfg.capabilities?.permissionManager?.getMode() || 'default',
      hasMemory: !!cfg.capabilities?.memoryManager,
      memoryText: cfg.capabilities?.memoryManager?.getAllMemoryText?.() ?? '',
      mcpServers: clients.map((client: any) => ({
        name: client.info?.name || 'mcp',
        connected: client.connected,
      })),
      hasSubagent: !!cfg.capabilities?.subagentManager,
      hasPlanning: !!cfg.capabilities?.planningManager,
    };
  }

  reloadAgent(): void {
    this.onUpdate?.();
  }

  // ── Personalization ──────────────────────────────────────
  getCustomInstructions(): string {
    return this.storage.getString(LS.customInstructions);
  }

  saveCustomInstructions(text: string): void {
    this.storage.setString(LS.customInstructions, text);
    this.onUpdate?.();
  }

  // ── Permission ───────────────────────────────────────────
  getPermissionMode(): string {
    return this.storage.getString(LS.permissionMode) || 'default';
  }

  savePermissionMode(mode: string): void {
    this.storage.setString(LS.permissionMode, mode);
    this._agentConfig?.capabilities?.permissionManager?.setMode(mode as any);
  }

  // ── Tools/Skills toggles ─────────────────────────────────
  getDisabledTools(): string[] {
    return this.storage.getJson<string[]>(LS.disabledTools, []);
  }

  saveDisabledTools(names: string[]): void {
    this.storage.setJson(LS.disabledTools, names);
    this.onUpdate?.();
  }

  getDisabledSkills(): string[] {
    return this.storage.getJson<string[]>(LS.disabledSkills, []);
  }

  saveDisabledSkills(names: string[]): void {
    this.storage.setJson(LS.disabledSkills, names);
    this.onUpdate?.();
  }

  // ── Memory ───────────────────────────────────────────────
  async addMemory(text: string): Promise<void> {
    const content = text.trim();
    if (!content) return;
    if (this._agentConfig?.capabilities?.memoryManager) {
      await this._agentConfig.capabilities.memoryManager.saveAutoMemory(content, 'user_note');
      return;
    }
    const entries = this.storage.getJson<MemoryEntry[]>(LS.memory, []);
    entries.push({ key: `mem_${Date.now()}`, content, source: 'user_note', timestamp: Date.now() });
    this.storage.setJson(LS.memory, entries);
  }

  async clearMemory(): Promise<void> {
    if (this._agentConfig?.capabilities?.memoryManager) {
      await this._agentConfig.capabilities.memoryManager.clearAutoMemory();
      return;
    }
    this.storage.setJson(LS.memory, []);
  }

  getMemoryEntries(): MemoryEntry[] {
    if (this._agentConfig?.capabilities?.memoryManager) {
      return this._agentConfig.capabilities.memoryManager.getAllEntries().map((e: any) => ({
        key: e.key,
        content: e.content,
        source: e.source || '',
        timestamp: e.timestamp,
      }));
    }
    return this.storage.getJson<MemoryEntry[]>(LS.memory, []);
  }

  async deleteMemoryEntry(key: string): Promise<void> {
    if (this._agentConfig?.capabilities?.memoryManager) {
      await this._agentConfig.capabilities.memoryManager.deleteEntry(key);
      return;
    }
    const entries = this.storage.getJson<MemoryEntry[]>(LS.memory, []);
    this.storage.setJson(LS.memory, entries.filter((e) => e.key !== key));
  }

  // ── Search ───────────────────────────────────────────────
  getSearchEndpoint(): string {
    return this.storage.getString(LS.searchEndpoint);
  }

  saveSearchEndpoint(url: string): void {
    if (url.trim()) this.storage.setString(LS.searchEndpoint, url.trim());
    else this.storage.remove(LS.searchEndpoint);
    this.onUpdate?.();
  }

  getSearchApiKey(): string {
    return this.storage.getString(LS.searchApiKey);
  }

  saveSearchApiKey(key: string): void {
    if (key.trim()) this.storage.setString(LS.searchApiKey, key.trim());
    else this.storage.remove(LS.searchApiKey);
    this.onUpdate?.();
  }

  getPreviewMode(): 'sidebar' | 'window' {
    const mode = this.storage.getString(LS.previewMode);
    return mode === 'window' ? 'window' : 'sidebar';
  }

  savePreviewMode(mode: 'sidebar' | 'window'): void {
    this.storage.setString(LS.previewMode, mode);
  }

  // ── Skills CRUD / install ────────────────────────────────
  async addSkill(skill: SkillFormData): Promise<void> {
    const def = {
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      scope: (skill.scope === 'repo' ? 'project' : skill.scope || 'user') as 'user' | 'project',
    };
    await SkillLoader.saveToStorage(this.platform.storage, def);
    this._agentConfig?.capabilities?.skillManager?.register(def);
    this.onUpdate?.();
  }

  async updateSkill(name: string, updates: SkillFormData): Promise<void> {
    await this.deleteSkill(name);
    await this.addSkill(updates);
  }

  async deleteSkill(name: string): Promise<void> {
    await SkillLoader.removeFromStorage(this.platform.storage, name);
    this._agentConfig?.capabilities?.skillManager?.unregister(name);
    const disabled = this.getDisabledSkills().filter((s) => s !== name);
    this.storage.setJson(LS.disabledSkills, disabled);
    this.onUpdate?.();
  }

  async installSkillFromUrl(url: string): Promise<{ success: boolean; error?: string }> {
    const installer = new SkillInstaller(this.platform.storage);
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

  async searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
    if (this.marketplaceConfig.skills === false) return [];
    const remote = await this.marketplace.search(query, this.marketplaceConfig.pageSize ?? 20);
    return this.marketplace.toMarketplaceSkills(remote, this.platform.storage);
  }

  async browseMarketplace(options?: { view?: string; page?: number }): Promise<{ skills: MarketplaceSkill[]; total: number }> {
    if (this.marketplaceConfig.skills === false) return { skills: [], total: 0 };
    const result = await this.marketplace.list({
      view: (options?.view as 'all-time' | 'trending' | 'hot') || this.marketplaceConfig.defaultSkillView || 'trending',
      page: options?.page ?? 0,
      perPage: this.marketplaceConfig.pageSize ?? 20,
    });
    const skills = await this.marketplace.toMarketplaceSkills(result.skills, this.platform.storage);
    return { skills, total: result.total };
  }

  async installFromMarketplace(skillId: string): Promise<{ success: boolean; error?: string }> {
    if (this.marketplaceConfig.skills === false) {
      return { success: false, error: 'Skill marketplace is disabled' };
    }
    const result = await this.marketplace.install(skillId, this.platform.storage);
    if (result.success && result.skill) {
      this._agentConfig?.capabilities?.skillManager?.register(result.skill);
      this.onUpdate?.();
    }
    return { success: result.success, error: result.error };
  }

  // ── MCP ──────────────────────────────────────────────────
  getMcpServerConfigs(): McpServerConfig[] {
    return this.storage.getJson<McpServerConfig[]>(LS.mcpServers, []);
  }

  async addMcpServer(server: McpServerConfig): Promise<void> {
    const servers = this.getMcpServerConfigs();
    servers.push({ ...server, transport: 'http' });
    this.storage.setJson(LS.mcpServers, servers);
    this.onUpdate?.();
  }

  async removeMcpServer(name: string): Promise<void> {
    const servers = this.getMcpServerConfigs().filter((s) => s.name !== name);
    this.storage.setJson(LS.mcpServers, servers);
    this.onUpdate?.();
  }

  async toggleMcpServer(name: string, enabled: boolean): Promise<void> {
    const servers = this.getMcpServerConfigs().map((s) =>
      s.name === name ? { ...s, enabled } : s,
    );
    this.storage.setJson(LS.mcpServers, servers);
    this.onUpdate?.();
  }

  async getMcpServerTools(serverName: string): Promise<string[]> {
    const clients = this._agentConfig?.capabilities?.mcpClients ?? [];
    const client = clients.find((c) => c.info?.name === serverName);
    if (!client || !client.connected) return [];
    try {
      return (await client.listTools()).map((t) => t.name);
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
    this.storage.setJson(LS.mcpServers, servers);
    this.onUpdate?.();
  }

  async searchMcpMarketplace(query: string): Promise<{ servers: Array<{ id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }>; pagination: { totalCount: number } }> {
    if (this.marketplaceConfig.mcp === false) {
      return { servers: [], pagination: { totalCount: 0 } };
    }
    const result = await this.mcpMarketplace.search(query);
    return {
      servers: result.servers.map((s: any) => ({
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
    if (this.marketplaceConfig.mcp === false) {
      return { success: false, error: 'MCP marketplace is disabled' };
    }
    try {
      await this.mcpMarketplace.install(qualifiedName, this.platform.storage);
      this.onUpdate?.();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Install failed' };
    }
  }

  // ── Integrations ────────────────────────────────────────
  getIntegrations(): IntegrationCardData[] {
    return this.integrationStore.getIntegrations();
  }

  async toggleIntegration(id: string, enabled: boolean): Promise<void> {
    await this.integrationStore.toggleIntegration(id, enabled);
    this.onUpdate?.();
  }

  async setIntegrationCredential(id: string, key: string, value: string): Promise<void> {
    await this.integrationStore.setCredential(id, key, value);
  }

  private async hydrateIntegrationMirror(): Promise<void> {
    await this.integrationStore.hydrateMirror();
    this.onUpdate?.();
  }
}
