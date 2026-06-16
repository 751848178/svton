/**
 * Default localStorage-based settings adapter.
 * Implements ISettingsAdapter from @svton/agent-ui.
 * Users get full settings persistence with zero configuration.
 */

import type {
  ISettingsAdapter,
  AgentData,
  ProviderInfo,
  ToolInfo,
  SkillInfo,
  McpServerInfo,
  SkillFormData,
  MemoryEntry,
} from '@svton/agent-ui';
import type { ProviderConfig } from '../types';

const LS = {
  providers: 'svton-app:providers',
  defaultModel: 'svton-app:defaultModel',
  customInstructions: 'svton-app:customInstructions',
  permissionMode: 'svton-app:permissionMode',
  disabledTools: 'svton-app:disabledTools',
  disabledSkills: 'svton-app:disabledSkills',
  searchEndpoint: 'svton-app:searchEndpoint',
  mcpServers: 'svton-app:mcpServers',
  memory: 'svton-app:memory',
};

function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore quota errors */ }
}

export class DefaultSettingsAdapter implements ISettingsAdapter {
  private _agentData: AgentData | null = null;
  onUpdate?: () => void;

  constructor(
    private initialProviders: ProviderConfig[],
  ) {
    // Initialize providers in localStorage if not set
    const existing = getItem<ProviderInfo[] | null>(LS.providers, null);
    if (!existing || existing.length === 0) {
      this._initProviders();
    }
  }

  getStorageDescription(): string {
    return 'localStorage (browser)';
  }

  setAgentData(data: AgentData | null) {
    this._agentData = data;
  }

  private _initProviders() {
    const providers: ProviderInfo[] = this.initialProviders.map((p, i) => ({
      id: p.name || p.type,
      name: p.name || p.type,
      type: p.type,
      baseUrl: p.baseUrl || (p.type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'),
      apiKey: p.apiKey,
      models: p.models.map(m => ({ id: m.id, name: m.name })),
    }));
    setItem(LS.providers, providers);
  }

  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[] {
    return getItem<ProviderInfo[]>(LS.providers, []);
  }
  setProviders(providers: ProviderInfo[]): void {
    setItem(LS.providers, providers);
  }
  saveProviders(providers: ProviderInfo[]): void {
    setItem(LS.providers, providers);
  }

  // ── Model ────────────────────────────────────────────────
  getDefaultModel(): string {
    return localStorage.getItem(LS.defaultModel) || '';
  }
  setDefaultModel(key: string): void {
    localStorage.setItem(LS.defaultModel, key);
  }

  // ── Agent data ───────────────────────────────────────────
  getAgentData(): AgentData | null {
    return this._agentData;
  }
  reloadAgent(): void {
    this.onUpdate?.();
  }

  // ── Personalization ──────────────────────────────────────
  getCustomInstructions(): string {
    return localStorage.getItem(LS.customInstructions) || '';
  }
  saveCustomInstructions(text: string): void {
    localStorage.setItem(LS.customInstructions, text);
  }

  // ── Permission ───────────────────────────────────────────
  getPermissionMode(): string {
    return localStorage.getItem(LS.permissionMode) || 'default';
  }
  savePermissionMode(mode: string): void {
    localStorage.setItem(LS.permissionMode, mode);
  }

  // ── Tools/Skills toggles ─────────────────────────────────
  getDisabledTools(): string[] {
    return getItem<string[]>(LS.disabledTools, []);
  }
  saveDisabledTools(names: string[]): void {
    setItem(LS.disabledTools, names);
  }
  getDisabledSkills(): string[] {
    return getItem<string[]>(LS.disabledSkills, []);
  }
  saveDisabledSkills(names: string[]): void {
    setItem(LS.disabledSkills, names);
  }

  // ── Memory ───────────────────────────────────────────────
  addMemory(text: string): void {
    const entries = getItem<MemoryEntry[]>(LS.memory, []);
    entries.push({ key: `mem_${Date.now()}`, content: text, source: 'user', timestamp: Date.now() });
    setItem(LS.memory, entries);
  }
  clearMemory(): void {
    setItem(LS.memory, []);
  }
  getMemoryEntries(): MemoryEntry[] {
    return getItem<MemoryEntry[]>(LS.memory, []);
  }
  deleteMemoryEntry(key: string): void {
    const entries = getItem<MemoryEntry[]>(LS.memory, []);
    setItem(LS.memory, entries.filter(e => e.key !== key));
  }

  // ── Search ───────────────────────────────────────────────
  getSearchEndpoint(): string {
    return localStorage.getItem(LS.searchEndpoint) || '';
  }
  saveSearchEndpoint(url: string): void {
    localStorage.setItem(LS.searchEndpoint, url);
  }

  // ── Skills CRUD (basic) ──────────────────────────────────
  addSkill?(skill: SkillFormData): void {
    // Basic localStorage skill persistence
    const skills = getItem<SkillFormData[]>('svton-app:customSkills', []);
    skills.push(skill);
    setItem('svton-app:customSkills', skills);
  }
  updateSkill?(name: string, updates: SkillFormData): void {
    const skills = getItem<SkillFormData[]>('svton-app:customSkills', []);
    const idx = skills.findIndex(s => s.name === name);
    if (idx >= 0) { skills[idx] = { ...skills[idx], ...updates }; setItem('svton-app:customSkills', skills); }
  }
  deleteSkill?(name: string): void {
    const skills = getItem<SkillFormData[]>('svton-app:customSkills', []);
    setItem('svton-app:customSkills', skills.filter(s => s.name !== name));
  }
  installSkillFromUrl?(url: string): Promise<{ success: boolean; error?: string }> {
    return Promise.resolve({ success: false, error: 'Not supported in default adapter' });
  }

  // ── MCP ──────────────────────────────────────────────────
  getMcpServers?(): McpServerInfo[] {
    return getItem<McpServerInfo[]>(LS.mcpServers, []);
  }
  addMcpServer?(server: McpServerInfo): void {
    const servers = getItem<McpServerInfo[]>(LS.mcpServers, []);
    servers.push(server);
    setItem(LS.mcpServers, servers);
  }
  removeMcpServer?(name: string): void {
    const servers = getItem<McpServerInfo[]>(LS.mcpServers, []);
    setItem(LS.mcpServers, servers.filter(s => s.name !== name));
  }
}
