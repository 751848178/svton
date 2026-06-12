import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@svton/ui';

// ════════════════════════════════════════════════════════════
// Shared types
// ════════════════════════════════════════════════════════════

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
// ISettingsAdapter — platform abstraction
// ════════════════════════════════════════════════════════════

/**
 * Platform adapter for the settings UI.
 * Each platform (Tauri, Browser, VS Code…) implements this interface.
 * The SettingsView calls these methods to load/save data and manage state.
 *
 * Methods are organized by section. All data access is through getters.
 * All mutations are through setters/save methods.
 */
export interface ISettingsAdapter {
  // ── Providers ────────────────────────────────────────────
  getProviders(): ProviderInfo[];
  setProviders(providers: ProviderInfo[]): void;
  saveProviders(providers: ProviderInfo[]): void | Promise<void>;

  // ── Model selection ──────────────────────────────────────
  getDefaultModel(): string;
  setDefaultModel(key: string): void;

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
  savePermissionMode(mode: string): void;

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

// ════════════════════════════════════════════════════════════
// Helper hooks — manage reactive state internally
// ════════════════════════════════════════════════════════════

function useAdapterState(adapter: ISettingsAdapter, refreshKey: number) {
  // Local mutable state, synced from adapter on mount and when refreshKey changes
  const [providers, setProviders] = useState(() => adapter.getProviders());
  const [defaultModel, setDefaultModel] = useState(() => adapter.getDefaultModel());
  const [agentData, setAgentData] = useState<AgentData | null>(() => adapter.getAgentData());
  const [customInstructions, setCustomInstructions] = useState(() => adapter.getCustomInstructions());
  const [permissionMode, setPermissionMode] = useState(() => adapter.getPermissionMode());
  const [disabledTools, setDisabledTools] = useState(() => adapter.getDisabledTools());
  const [disabledSkills, setDisabledSkills] = useState(() => adapter.getDisabledSkills());
  const [searchEndpoint, setSearchEndpoint] = useState(() => adapter.getSearchEndpoint?.() ?? '');

  // Re-read all state from adapter when refreshKey changes
  useEffect(() => {
    setProviders(adapter.getProviders());
    setDefaultModel(adapter.getDefaultModel());
    setAgentData(adapter.getAgentData());
    setCustomInstructions(adapter.getCustomInstructions());
    setPermissionMode(adapter.getPermissionMode());
    setDisabledTools(adapter.getDisabledTools());
    setDisabledSkills(adapter.getDisabledSkills());
    setSearchEndpoint(adapter.getSearchEndpoint?.() ?? '');
  }, [adapter, refreshKey]);

  const reload = useCallback(async () => {
    await adapter.reloadAgent();
    setAgentData(adapter.getAgentData());
    setProviders(adapter.getProviders());
    setDefaultModel(adapter.getDefaultModel());
  }, [adapter]);

  return {
    providers, defaultModel, agentData, customInstructions, permissionMode,
    disabledTools, disabledSkills, searchEndpoint,
    setProviders, setDefaultModel, setAgentData, setCustomInstructions,
    setPermissionMode, setDisabledTools, setDisabledSkills, setSearchEndpoint,
    reload,
  };
}

// ════════════════════════════════════════════════════════════
// SettingsView props
// ════════════════════════════════════════════════════════════

export interface SettingsViewProps {
  adapter: ISettingsAdapter;
  onBack: () => void;
  /** Increment to force a full re-read from the adapter */
  refreshKey?: number;
}

// ── Section definitions ────────────────────────────────────

type SectionId =
  | 'general' | 'providers' | 'personalization'
  | 'tools' | 'skills' | 'marketplace' | 'mcp'
  | 'permissions' | 'memory' | 'search' | 'automation';

interface SectionDef { id: SectionId; label: string; group: string; }

const DEFAULT_SECTIONS: SectionDef[] = [
  { id: 'general', label: '常规', group: '个人' },
  { id: 'providers', label: '配置', group: '个人' },
  { id: 'personalization', label: '个性化', group: '个人' },
  { id: 'tools', label: '工具', group: '集成' },
  { id: 'skills', label: '技能', group: '集成' },
  { id: 'marketplace', label: '技能市场', group: '集成' },
  { id: 'mcp', label: 'MCP 服务器', group: '集成' },
  { id: 'permissions', label: '权限', group: '编码' },
  { id: 'memory', label: '记忆', group: '编码' },
  { id: 'automation', label: '自动化', group: '编码' },
];

const GROUPS = ['个人', '集成', '编码'] as const;

// ── Small shared components ────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={cn('relative inline-flex h-[18px] w-[32px] items-center rounded-full transition-colors cursor-pointer flex-shrink-0', checked ? 'bg-cyan-600' : 'bg-[#333]')}>
      <span className={cn('inline-block h-3 w-3 rounded-full bg-white transition-transform', checked ? 'translate-x-[17px]' : 'translate-x-[3px]')} />
    </button>
  );
}

function Badge({ color, children }: { color: 'green' | 'blue' | 'yellow' | 'gray' | 'red'; children: React.ReactNode }) {
  const colors = { green: 'bg-green-900/40 text-green-400', blue: 'bg-blue-900/40 text-blue-400', yellow: 'bg-yellow-900/40 text-yellow-400', gray: 'bg-[#2a2a2a] text-gray-500', red: 'bg-red-900/40 text-red-400' };
  return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', colors[color])}>{children}</span>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-5', className)}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1.5">{children}</label>;
}

// ── Sidebar nav icons ──────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  general: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  providers: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  personalization: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  tools: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  skills: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  marketplace: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  mcp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  permissions: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  memory: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  automation: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
};

// ════════════════════════════════════════════════════════════
// Main SettingsView
// ════════════════════════════════════════════════════════════

export function SettingsView({ adapter, onBack, refreshKey: refreshKeyProp }: SettingsViewProps) {
  const refreshKey = refreshKeyProp ?? 0;
  const [activeSection, setActiveSection] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newPName, setNewPName] = useState('');
  const [newPType, setNewPType] = useState<'openai' | 'anthropic'>('openai');
  const [newPUrl, setNewPUrl] = useState('');
  const [memoryInput, setMemoryInput] = useState('');
  const [toast, setToast] = useState('');

  const s = useAdapterState(adapter, refreshKey);

  // Track whether providers have unsaved changes
  const providersChanged = useMemo(() => {
    const orig = adapter.getProviders();
    if (s.providers.length !== orig.length) return true;
    return s.providers.some((p, i) => {
      const o = orig[i];
      if (!o) return true;
      return p.name !== o.name || p.type !== o.type || p.baseUrl !== o.baseUrl || p.apiKey !== o.apiKey
        || p.models.length !== o.models.length
        || p.models.some((m, j) => !o.models[j] || m.id !== o.models[j].id || m.name !== o.models[j].name);
    });
  }, [s.providers, adapter]);

  // Build sections list — add search section if adapter supports it
  const sections = useMemo(() => {
    const list = [...DEFAULT_SECTIONS];
    if (adapter.getSearchEndpoint) {
      list.splice(8, 0, { id: 'search' as SectionId, label: '网页搜索', group: '编码' });
    }
    return list;
  }, [adapter]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((sec) => sec.label.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  // Derived data
  const allModels = useMemo(() =>
    s.providers.flatMap((p) => p.models.map((m) => ({
      providerId: p.id, providerName: p.name, modelId: m.id, modelName: m.name,
    }))),
    [s.providers],
  );

  const agent = s.agentData;
  const tools = agent?.tools ?? [];
  const skills = agent?.skills ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-cyan-900 text-cyan-100 text-sm rounded-lg shadow-lg">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            返回
          </button>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-white font-medium">设置</span>
        </div>
        {adapter.openInEditor && (
          <button onClick={() => adapter.openInEditor!()} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-white border border-[#333] rounded-md hover:border-gray-500 transition-colors">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            在编辑器中打开
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-[#1a1a1a] flex flex-col">
          <div className="px-3 pt-3 pb-2">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索设置..."
              className="w-full px-2.5 py-1.5 text-[12px] bg-[#1c1c1c] border border-[#2a2a2a] rounded-md text-gray-300 placeholder:text-gray-600 outline-none focus:border-[#444]" />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {GROUPS.map((group) => {
              const gs = filteredSections.filter((sec) => sec.group === group);
              if (!gs.length) return null;
              return (
                <div key={group} className="mt-3 first:mt-0">
                  <div className="px-2 py-1 text-[10px] text-gray-600 uppercase tracking-wider font-medium">{group}</div>
                  {gs.map((sec) => (
                    <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                      className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors text-left',
                        activeSection === sec.id ? 'bg-[#1c1c1c] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]')}>
                      <span className="opacity-60">{ICONS[sec.id]}</span>{sec.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-6">
            {activeSection === 'general' && (
              <GeneralSection allModels={allModels} defaultModel={s.defaultModel} onModelChange={(k) => { adapter.setDefaultModel(k); s.setDefaultModel(k); }}
                workingDir={adapter.getWorkingDir?.()}
                onWorkingDirChange={adapter.setWorkingDir?.bind(adapter)}
                storageDescription={adapter.getStorageDescription()} />
            )}
            {activeSection === 'providers' && (
              <ProvidersSection providers={s.providers} showKey={showKey} setShowKey={setShowKey}
                showAddProvider={showAddProvider} setShowAddProvider={setShowAddProvider}
                newName={newPName} setNewName={setNewPName} newType={newPType} setNewType={setNewPType}
                newUrl={newPUrl} setNewUrl={setNewPUrl}
                onSave={async () => { await adapter.saveProviders(s.providers); showToast('已保存'); }}
                onUpdate={(i, u) => { const next = s.providers.map((p, idx) => idx === i ? { ...p, ...u } : p); s.setProviders(next); }}
                onRemove={(i) => { s.setProviders(s.providers.filter((_, idx) => idx !== i)); }}
                onAdd={() => {
                  const p: ProviderInfo = { id: `custom_${Date.now()}`, name: newPName.trim(), type: newPType, baseUrl: newPUrl.trim(), apiKey: '', models: [] };
                  s.setProviders([...s.providers, p]);
                  setNewPName(''); setNewPUrl(''); setShowAddProvider(false);
                }}
                hasChanges={providersChanged}
              />
            )}
            {activeSection === 'personalization' && (
              <PersonalizationSection value={s.customInstructions} onChange={s.setCustomInstructions}
                onSave={async () => { await adapter.saveCustomInstructions(s.customInstructions); showToast('已保存'); }} />
            )}
            {activeSection === 'tools' && (
              <ToolsListSection tools={tools} disabledTools={s.disabledTools} hasAgent={!!agent}
                onToggle={(name) => { const next = s.disabledTools.includes(name) ? s.disabledTools.filter((n) => n !== name) : [...s.disabledTools, name]; s.setDisabledTools(next); adapter.saveDisabledTools(next); }} />
            )}
            {activeSection === 'skills' && (
              <SkillsListSection skills={skills} disabledSkills={s.disabledSkills} hasAgent={!!agent}
                onToggle={(name) => { const next = s.disabledSkills.includes(name) ? s.disabledSkills.filter((n) => n !== name) : [...s.disabledSkills, name]; s.setDisabledSkills(next); adapter.saveDisabledSkills(next); }}
                onAdd={adapter.addSkill?.bind(adapter)} onUpdate={adapter.updateSkill?.bind(adapter)} onDelete={adapter.deleteSkill?.bind(adapter)}
                onReload={() => s.reload()} adapter={adapter} />
            )}
            {activeSection === 'marketplace' && adapter.searchMarketplace && (
              <MarketplaceSection adapter={adapter} onReload={() => s.reload()} />
            )}
            {activeSection === 'mcp' && (
              <McpSection servers={agent?.mcpServers ?? []}
                configs={adapter.getMcpServerConfigs?.() ?? []}
                onAdd={adapter.addMcpServer?.bind(adapter)}
                onRemove={adapter.removeMcpServer?.bind(adapter)}
                onToggle={adapter.toggleMcpServer?.bind(adapter)}
                getMcpServerTools={adapter.getMcpServerTools?.bind(adapter)}
                updateMcpServerToolConfig={adapter.updateMcpServerToolConfig?.bind(adapter)}
                searchMcpMarketplace={adapter.searchMcpMarketplace?.bind(adapter)}
                installFromMcpMarketplace={adapter.installFromMcpMarketplace?.bind(adapter)}
                supportsStdio={!!adapter.getWorkingDir?.()}
                onReload={() => s.reload()} />
            )}
            {activeSection === 'permissions' && (
              <PermissionsSection mode={s.permissionMode}
                onChange={(m) => { s.setPermissionMode(m); adapter.savePermissionMode(m); showToast('权限模式已更新'); }} />
            )}
            {activeSection === 'memory' && agent && (
              <MemorySection hasMemory={agent.hasMemory} memoryText={agent.memoryText}
                entries={adapter.getMemoryEntries?.() ?? []}
                memoryInput={memoryInput} setMemoryInput={setMemoryInput}
                onAdd={async () => { await adapter.addMemory(memoryInput); setMemoryInput(''); await s.reload(); showToast('记忆已添加'); }}
                onClear={async () => { await adapter.clearMemory(); await s.reload(); showToast('记忆已清除'); }}
                onDeleteEntry={async (key) => { if (adapter.deleteMemoryEntry) { await adapter.deleteMemoryEntry(key); await s.reload(); showToast('已删除'); } }} />
            )}
            {activeSection === 'search' && adapter.getSearchEndpoint && (
              <SearchSection endpoint={s.searchEndpoint} onChange={s.setSearchEndpoint}
                onSave={() => { adapter.saveSearchEndpoint!(s.searchEndpoint); showToast('已保存'); }} />
            )}
            {activeSection === 'automation' && agent && (
              <AutomationSection hasSubagent={agent.hasSubagent} hasPlanning={agent.hasPlanning} tools={agent.tools} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Section components (unchanged UI, simplified props)
// ════════════════════════════════════════════════════════════

function GeneralSection({ allModels, defaultModel, onModelChange, workingDir, onWorkingDirChange, storageDescription }: {
  allModels: Array<{ providerId: string; providerName: string; modelId: string; modelName: string }>;
  defaultModel: string; onModelChange: (k: string) => void;
  workingDir?: string; onWorkingDirChange?: (dir: string) => void | Promise<void>;
  storageDescription: string;
}) {
  const [editingDir, setEditingDir] = useState(false);
  const [dirInput, setDirInput] = useState(workingDir || '');

  const handleSaveDir = () => {
    if (dirInput.trim() && dirInput.trim() !== workingDir && onWorkingDirChange) {
      onWorkingDirChange(dirInput.trim());
    }
    setEditingDir(false);
  };

  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">常规</h2>
      <p className="text-xs text-gray-500 mb-6">基本的应用程序配置</p>
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          <span className="text-sm text-gray-200 font-medium">模型</span>
        </div>
        <div>
          <FieldLabel>默认模型</FieldLabel>
          <select value={defaultModel} onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-sm text-gray-200 outline-none focus:border-cyan-600 cursor-pointer appearance-none">
            {allModels.map((m) => (<option key={`${m.providerId}::${m.modelId}`} value={`${m.providerId}::${m.modelId}`}>{m.modelName} ({m.providerName})</option>))}
          </select>
          <p className="text-[10px] text-gray-600 mt-1">Agent 默认使用的模型，可在对话中切换</p>
        </div>
      </Card>
      {workingDir && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span className="text-sm text-gray-200 font-medium">工作目录</span></div>
          {editingDir ? (
            <div className="space-y-2">
              <input type="text" value={dirInput} onChange={(e) => setDirInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDir(); if (e.key === 'Escape') setEditingDir(false); }}
                className={INPUT_CLS} autoFocus />
              <div className="flex items-center gap-2">
                <button onClick={handleSaveDir} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">保存</button>
                <button onClick={() => setEditingDir(false)} className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300">取消</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm text-gray-400 font-mono bg-[#171717] rounded-lg px-3 py-2 border border-[#2a2a2a] truncate">{workingDir}</div>
              {onWorkingDirChange && (
                <button onClick={() => { setDirInput(workingDir); setEditingDir(true); }}
                  className="px-3 py-2 text-[11px] font-medium rounded-lg bg-[#222] border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex-shrink-0">
                  修改
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-1">Agent 在此目录下执行文件和命令操作</p>
        </Card>
      )}
      <Card>
        <div className="flex items-center gap-2 mb-4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span className="text-sm text-gray-200 font-medium">存储</span></div>
        <p className="text-[11px] text-gray-500">{storageDescription}</p>
      </Card>
    </div>
  );
}

const INPUT_CLS = 'w-full px-3 py-2 text-sm bg-[#222] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600 placeholder:text-gray-600';
const SELECT_CLS = 'w-full h-9 px-3 text-sm bg-[#222] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600 cursor-pointer';

function ProvidersSection({ providers, showKey, setShowKey, showAddProvider, setShowAddProvider,
  newName, setNewName, newType, setNewType, newUrl, setNewUrl,
  onSave, onUpdate, onRemove, onAdd, hasChanges,
}: {
  providers: ProviderInfo[];
  showKey: Record<string, boolean>; setShowKey: (fn: (p: Record<string, boolean>) => Record<string, boolean>) => void;
  showAddProvider: boolean; setShowAddProvider: (v: boolean) => void;
  newName: string; setNewName: (v: string) => void;
  newType: 'openai' | 'anthropic'; setNewType: (v: 'openai' | 'anthropic') => void;
  newUrl: string; setNewUrl: (v: string) => void;
  onSave: () => void; onUpdate: (i: number, u: Partial<ProviderInfo>) => void;
  onRemove: (i: number) => void; onAdd: () => void;
  hasChanges: boolean;
}) {
  // Per-provider state for adding models
  const [addingModelFor, setAddingModelFor] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const handleAddModel = (providerIdx: number, providerId: string) => {
    if (!newModelId.trim()) return;
    const p = providers[providerIdx];
    const models = [...p.models, { id: newModelId.trim(), name: newModelName.trim() || newModelId.trim() }];
    onUpdate(providerIdx, { models });
    setNewModelId('');
    setNewModelName('');
    setAddingModelFor(null);
  };

  const handleRemoveModel = (providerIdx: number, modelId: string) => {
    const p = providers[providerIdx];
    const models = p.models.filter((m) => m.id !== modelId);
    onUpdate(providerIdx, { models });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg text-white font-medium">配置</h2>
          <p className="text-xs text-gray-500 mt-0.5">管理 API 提供商和密钥配置</p>
        </div>
        {hasChanges && (
          <button onClick={onSave} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">
            保存配置
          </button>
        )}
      </div>
      <div className="space-y-4">
        {providers.map((p, i) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span className="text-sm text-white font-medium">{p.name}</span><span className="text-[10px] text-gray-600 uppercase px-1.5 py-0.5 bg-[#222] rounded">{p.type}</span></div>
              <div className="flex items-center gap-2">{p.apiKey && <Badge color="green">已配置</Badge>}<button onClick={() => onRemove(i)} className="text-[10px] text-gray-500 hover:text-red-400">删除</button></div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>名称</FieldLabel><input type="text" value={p.name} onChange={(e) => onUpdate(i, { name: e.target.value })} className={INPUT_CLS} /></div>
                <div><FieldLabel>类型</FieldLabel><select value={p.type} onChange={(e) => onUpdate(i, { type: e.target.value })} className={SELECT_CLS}><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option></select></div>
              </div>
              <div><FieldLabel>Base URL</FieldLabel><input type="text" value={p.baseUrl} onChange={(e) => onUpdate(i, { baseUrl: e.target.value })} placeholder="https://api.example.com" className={INPUT_CLS} /></div>
              <div>
                <FieldLabel>API Key</FieldLabel>
                <div className="relative">
                  <input type={showKey[p.id] ? 'text' : 'password'} value={p.apiKey} onChange={(e) => onUpdate(i, { apiKey: e.target.value })} placeholder="sk-..." className={cn(INPUT_CLS, 'pr-10')} />
                  <button onClick={() => setShowKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {showKey[p.id] ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                    </svg>
                  </button>
                </div>
              </div>
              {/* Models list with add/remove */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel>可用模型</FieldLabel>
                  <button onClick={() => { setAddingModelFor(p.id); setNewModelId(''); setNewModelName(''); }} className="text-[10px] text-cyan-500 hover:text-cyan-400">+ 添加模型</button>
                </div>
                {p.models.length === 0 && !addingModelFor && (
                  <p className="text-[11px] text-gray-600">暂无模型，点击上方按钮添加</p>
                )}
                <div className="space-y-1.5">
                  {p.models.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#171717] rounded-lg border border-[#2a2a2a] group">
                      <Toggle checked={true} onChange={() => handleRemoveModel(i, m.id)} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] text-gray-300 font-mono">{m.id}</span>
                        {m.name !== m.id && <span className="text-[11px] text-gray-500 ml-2">{m.name}</span>}
                      </div>
                      <button onClick={() => handleRemoveModel(i, m.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  {addingModelFor === p.id && (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="text" value={newModelId} onChange={(e) => setNewModelId(e.target.value)} placeholder="模型 ID (如 gpt-4o)" className={cn(INPUT_CLS, 'flex-1')} />
                      <input type="text" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="显示名称" className={cn(INPUT_CLS, 'flex-1')} />
                      <button onClick={() => handleAddModel(i, p.id)} disabled={!newModelId.trim()} className="px-3 h-9 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors flex-shrink-0">添加</button>
                      <button onClick={() => setAddingModelFor(null)} className="px-2 h-9 text-[11px] text-gray-500 hover:text-gray-300 flex-shrink-0">取消</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {showAddProvider ? (
        <Card className="mt-4 !border-dashed">
          <FieldLabel>添加自定义 Provider</FieldLabel>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名称" className={INPUT_CLS} />
              <select value={newType} onChange={(e) => setNewType(e.target.value as 'openai' | 'anthropic')} className={SELECT_CLS}><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option></select>
            </div>
            <input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://api.example.com" className={INPUT_CLS} />
            <div className="flex items-center gap-2">
              <button onClick={onAdd} disabled={!newName.trim() || !newUrl.trim()} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors">添加</button>
              <button onClick={() => setShowAddProvider(false)} className="px-3 py-1.5 text-[12px] text-gray-500 hover:text-gray-300">取消</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowAddProvider(true)} className="w-full mt-4 py-3 text-sm rounded-xl border border-dashed border-[#333] text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors">+ 添加自定义 Provider</button>
      )}
    </div>
  );
}

function PersonalizationSection({ value, onChange, onSave }: { value: string; onChange: (v: string) => void; onSave: () => void }) {
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">个性化</h2>
      <p className="text-xs text-gray-500 mb-6">自定义 Agent 的行为和回复风格</p>
      <Card>
        <FieldLabel>自定义指令</FieldLabel>
        <p className="text-[10px] text-gray-600 mb-2">这些指令会附加到系统提示中，影响 Agent 的回复风格和行为</p>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={"例如：\n- 使用中文回复\n- 代码注释使用英文\n- 优先使用函数式编程风格"} className="w-full text-sm text-gray-200 bg-[#171717] rounded-lg p-3 border border-[#2a2a2a] focus:border-cyan-600 outline-none placeholder:text-gray-600 resize-none h-48" />
        <div className="mt-3"><button onClick={onSave} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">保存</button></div>
      </Card>
    </div>
  );
}

function ToolsListSection({ tools, disabledTools, hasAgent, onToggle }: { tools: ToolInfo[]; disabledTools: string[]; hasAgent: boolean; onToggle: (name: string) => void }) {
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">工具</h2>
      <p className="text-xs text-gray-500 mb-6">LLM 可调用的工具。关闭后 Agent 将无法使用该工具。</p>
      {!hasAgent ? <Card><div className="text-center py-6 text-gray-600 text-sm">Agent 未初始化。请先配置 API Key 后重试。</div></Card> :
      tools.length === 0 ? <Card><div className="text-center py-6 text-gray-600 text-sm">无已注册工具</div></Card> : (
        <Card className="!p-0 divide-y divide-[#2a2a2a]">
          {tools.map((t) => { const d = disabledTools.includes(t.name); return (
            <div key={t.name} className={cn('px-4 py-3 flex items-center gap-3 transition-opacity', d && 'opacity-40')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-sm text-gray-200 font-mono">{t.name}</span>{t.annotations?.readOnlyHint && <Badge color="green">只读</Badge>}{t.annotations?.destructiveHint && <Badge color="red">破坏性</Badge>}</div>
                <div className="text-[11px] text-gray-500 truncate">{t.description}</div>
                {t.parameters?.properties && (<div className="mt-1 flex flex-wrap gap-1">{Object.keys(t.parameters.properties).map((p) => (<span key={p} className="text-[10px] font-mono bg-[#222] text-gray-500 px-1.5 py-0.5 rounded">{p}{t.parameters.required?.includes(p) && <span className="text-red-400">*</span>}</span>))}</div>)}
              </div>
              <Toggle checked={!d} onChange={() => onToggle(t.name)} />
            </div>
          ); })}
        </Card>
      )}
    </div>
  );
}

// ── Marketplace Section ─────────────────────────────────────

function MarketplaceSection({ adapter, onReload }: { adapter: ISettingsAdapter; onReload: () => void }) {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'trending' | 'all-time' | 'hot'>('trending');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  const loadSkills = useCallback(async (opts?: { query?: string; view?: string; page?: number }) => {
    setLoading(true);
    setError(null);
    try {
      if (opts?.query) {
        const results = await adapter.searchMarketplace!(opts.query);
        setSkills(results);
        setTotal(results.length);
      } else {
        const result = await adapter.browseMarketplace!({
          view: opts?.view || viewMode,
          page: opts?.page ?? page,
        });
        setSkills(result.skills);
        setTotal(result.total);
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    }
    setLoading(false);
  }, [adapter, viewMode, page]);

  useEffect(() => { loadSkills(); }, []);

  const handleSearch = () => {
    setPage(0);
    if (searchQuery.trim()) {
      loadSkills({ query: searchQuery.trim() });
    } else {
      loadSkills({ view: viewMode, page: 0 });
    }
  };

  const handleViewChange = (v: 'trending' | 'all-time' | 'hot') => {
    setViewMode(v);
    setPage(0);
    setSearchQuery('');
    loadSkills({ view: v, page: 0 });
  };

  const handleInstall = async (skillId: string) => {
    if (!adapter.installFromMarketplace) return;
    setInstallingId(skillId);
    setInstallStatus(null);
    try {
      const r = await adapter.installFromMarketplace(skillId);
      setInstallStatus(r.success ? '安装成功' : `失败: ${r.error}`);
      if (r.success) {
        onReload();
        // Update local installed status
        setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, installed: true } : s));
      }
    } catch (e: any) {
      setInstallStatus(`失败: ${e.message}`);
    }
    setInstallingId(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg text-white font-medium">技能市场</h2>
        <p className="text-xs text-gray-500 mt-0.5">浏览 skills.sh 上的社区技能，搜索并一键安装。</p>
      </div>

      {/* Search + View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索技能..."
            className={cn(INPUT_CLS, 'flex-1')}
          />
          <button onClick={handleSearch} disabled={loading} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors whitespace-nowrap">搜索</button>
        </div>
        <div className="flex items-center gap-1 bg-[#171717] rounded-lg p-0.5">
          {(['trending', 'all-time', 'hot'] as const).map((v) => (
            <button key={v} onClick={() => handleViewChange(v)}
              className={cn('px-2.5 py-1 text-[10px] rounded-md transition-colors',
                viewMode === v && !searchQuery ? 'bg-[#2a2a2a] text-white' : 'text-gray-500 hover:text-gray-300')}>
              {v === 'trending' ? '趋势' : v === 'all-time' ? '全部' : '热门'}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {installStatus && (
        <div className={cn('text-[11px] px-3 py-2 rounded-lg mb-3', installStatus.startsWith('安装成功') ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20')}>{installStatus}</div>
      )}
      {error && (
        <div className="text-[11px] px-3 py-2 rounded-lg mb-3 text-red-400 bg-red-900/20">{error}</div>
      )}

      {/* Skills grid */}
      {loading ? (
        <Card><div className="text-center py-8 text-gray-600 text-sm">加载中...</div></Card>
      ) : skills.length === 0 ? (
        <Card><div className="text-center py-8 text-gray-600 text-sm">无匹配技能</div></Card>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <Card key={skill.id} className="!py-3 !px-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-gray-200 font-medium truncate">{skill.name}</span>
                  {skill.installed && <Badge color="green">已安装</Badge>}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {skill.source} · {skill.installs.toLocaleString()} 次安装
                </div>
              </div>
              <button
                onClick={() => skill.installed ? null : handleInstall(skill.id)}
                disabled={installingId === skill.id || skill.installed}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0',
                  skill.installed
                    ? 'bg-[#222] text-gray-600 cursor-default'
                    : 'bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50',
                )}
              >
                {installingId === skill.id ? '安装中...' : skill.installed ? '已安装' : '安装'}
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!searchQuery && total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => { const p = Math.max(0, page - 1); setPage(p); loadSkills({ view: viewMode, page: p }); }}
            disabled={page === 0 || loading} className="px-3 py-1.5 text-[11px] text-gray-400 hover:text-white border border-[#333] rounded-lg disabled:opacity-30">
            上一页
          </button>
          <span className="text-[11px] text-gray-600">第 {page + 1} 页 · 共 {Math.ceil(total / 20)} 页</span>
          <button onClick={() => { const p = page + 1; setPage(p); loadSkills({ view: viewMode, page: p }); }}
            disabled={(page + 1) * 20 >= total || loading} className="px-3 py-1.5 text-[11px] text-gray-400 hover:text-white border border-[#333] rounded-lg disabled:opacity-30">
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

function SkillsListSection({ skills, disabledSkills, hasAgent, onToggle, onAdd, onUpdate, onDelete, onReload, adapter }: {
  skills: SkillInfo[]; disabledSkills: string[]; hasAgent: boolean; onToggle: (name: string) => void;
  onAdd?: (skill: SkillFormData) => void | Promise<void>;
  onUpdate?: (name: string, updates: SkillFormData) => void | Promise<void>;
  onDelete?: (name: string) => void | Promise<void>;
  onReload: () => void;
  adapter: ISettingsAdapter;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installGit, setInstallGit] = useState('');
  const [installLocal, setInstallLocal] = useState('');
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const advancedInstall = adapter.supportsAdvancedInstall?.() ?? false;

  const resetForm = () => { setFormName(''); setFormDesc(''); setFormInstructions(''); setShowAdd(false); setEditingSkill(null); };

  const handleAdd = async () => {
    if (!onAdd || !formName.trim()) return;
    await onAdd({ name: formName.trim(), description: formDesc.trim(), instructions: formInstructions });
    resetForm();
    onReload();
  };

  const handleEdit = async () => {
    if (!onUpdate || !editingSkill) return;
    await onUpdate(editingSkill, { name: formName.trim(), description: formDesc.trim(), instructions: formInstructions });
    resetForm();
    onReload();
  };

  const handleDelete = async (name: string) => {
    if (!onDelete) return;
    await onDelete(name);
    onReload();
  };

  const startEdit = (s: SkillInfo) => {
    setEditingSkill(s.name);
    setFormName(s.name);
    setFormDesc(s.description);
    setFormInstructions('');
    setShowAdd(false);
  };

  const handleInstallUrl = async () => {
    if (!adapter.installSkillFromUrl || !installUrl.trim()) return;
    setInstalling(true); setInstallStatus(null);
    try {
      const r = await adapter.installSkillFromUrl(installUrl.trim());
      setInstallStatus(r.success ? '安装成功' : `失败: ${r.error}`);
      if (r.success) { setInstallUrl(''); onReload(); }
    } catch (e: any) { setInstallStatus(`失败: ${e.message}`); }
    setInstalling(false);
  };
  const handleInstallGit = async () => {
    if (!adapter.installSkillFromGit || !installGit.trim()) return;
    setInstalling(true); setInstallStatus(null);
    try {
      const r = await adapter.installSkillFromGit(installGit.trim());
      setInstallStatus(r.success ? '安装成功' : `失败: ${r.error}`);
      if (r.success) { setInstallGit(''); onReload(); }
    } catch (e: any) { setInstallStatus(`失败: ${e.message}`); }
    setInstalling(false);
  };
  const handleInstallLocal = async () => {
    if (!adapter.installSkillFromLocal || !installLocal.trim()) return;
    setInstalling(true); setInstallStatus(null);
    try {
      const r = await adapter.installSkillFromLocal(installLocal.trim());
      setInstallStatus(r.success ? '安装成功' : `失败: ${r.error}`);
      if (r.success) { setInstallLocal(''); onReload(); }
    } catch (e: any) { setInstallStatus(`失败: ${e.message}`); }
    setInstalling(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg text-white font-medium">技能</h2>
          <p className="text-xs text-gray-500 mt-0.5">预定义的技能模板，匹配用户消息时自动注入上下文。</p>
        </div>
        <div className="flex items-center gap-2">
          {adapter.installSkillFromUrl && !showAdd && !editingSkill && (
            <button onClick={() => setShowInstall(!showInstall)} className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors">{showInstall ? '关闭' : '安装技能'}</button>
          )}
          {onAdd && !showAdd && !editingSkill && (
            <button onClick={() => { resetForm(); setShowAdd(true); }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ 添加技能</button>
          )}
        </div>
      </div>

      {/* Install panel */}
      {showInstall && (
        <Card className="mb-4 !border-cyan-900/50">
          <div className="text-sm text-cyan-400 font-medium mb-3">安装技能</div>
          <div className="space-y-3">
            <div>
              <FieldLabel>从 URL 安装 (SKILL.md 地址)</FieldLabel>
              <div className="flex items-center gap-2">
                <input type="text" value={installUrl} onChange={(e) => setInstallUrl(e.target.value)} placeholder="https://example.com/SKILL.md" className={cn(INPUT_CLS, 'flex-1')} />
                <button onClick={handleInstallUrl} disabled={installing || !installUrl.trim()} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors whitespace-nowrap">安装</button>
              </div>
            </div>
            {advancedInstall && adapter.installSkillFromGit && (
              <div>
                <FieldLabel>从 Git 仓库安装</FieldLabel>
                <div className="flex items-center gap-2">
                  <input type="text" value={installGit} onChange={(e) => setInstallGit(e.target.value)} placeholder="https://github.com/user/skill-repo" className={cn(INPUT_CLS, 'flex-1')} />
                  <button onClick={handleInstallGit} disabled={installing || !installGit.trim()} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors whitespace-nowrap">安装</button>
                </div>
              </div>
            )}
            {advancedInstall && adapter.installSkillFromLocal && (
              <div>
                <FieldLabel>从本地目录安装</FieldLabel>
                <div className="flex items-center gap-2">
                  <input type="text" value={installLocal} onChange={(e) => setInstallLocal(e.target.value)} placeholder="/path/to/skill-directory" className={cn(INPUT_CLS, 'flex-1')} />
                  <button onClick={handleInstallLocal} disabled={installing || !installLocal.trim()} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors whitespace-nowrap">安装</button>
                </div>
              </div>
            )}
            {installStatus && (
              <div className={cn('text-[11px] px-3 py-2 rounded-lg', installStatus.startsWith('安装成功') ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20')}>{installStatus}</div>
            )}
          </div>
        </Card>
      )}

      {/* Add / Edit form */}
      {(showAdd || editingSkill) && (
        <Card className="mb-4 !border-cyan-900/50">
          <div className="text-sm text-cyan-400 font-medium mb-3">{editingSkill ? `编辑: ${editingSkill}` : '添加新技能'}</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>名称</FieldLabel><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="my-skill" className={INPUT_CLS} disabled={!!editingSkill} /></div>
              <div><FieldLabel>描述</FieldLabel><input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="描述技能用途..." className={INPUT_CLS} /></div>
            </div>
            <div><FieldLabel>指令内容</FieldLabel><textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} placeholder="技能的详细指令（Markdown 格式）..." className="w-full text-xs text-gray-300 bg-[#171717] rounded-lg p-3 border border-[#2a2a2a] focus:border-cyan-600 outline-none placeholder:text-gray-600 resize-none h-32" /></div>
            <div className="flex items-center gap-2">
              <button onClick={editingSkill ? handleEdit : handleAdd} disabled={!formName.trim()} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors">{editingSkill ? '保存修改' : '添加'}</button>
              <button onClick={resetForm} className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300">取消</button>
            </div>
          </div>
        </Card>
      )}

      {!hasAgent ? <Card><div className="text-center py-6 text-gray-600 text-sm">Agent 未初始化。请先配置 API Key 后重试。</div></Card> :
      skills.length === 0 ? <Card><div className="text-center py-6 text-gray-600 text-sm">无已加载技能</div></Card> : (
        <Card className="!p-0 divide-y divide-[#2a2a2a]">
          {skills.map((s) => { const d = disabledSkills.includes(s.name); return (
            <div key={s.name} className={cn('px-4 py-3 flex items-center gap-3 transition-opacity group', d && 'opacity-40')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-sm text-gray-200 font-mono">{s.name}</span>{s.scope && <Badge color="blue">{s.scope}</Badge>}{s.trigger?.type === 'explicit' && <Badge color="gray">显式</Badge>}{s.trigger?.type === 'implicit' && <Badge color="yellow">隐式</Badge>}</div>
                <div className="text-[11px] text-gray-500 truncate">{s.description}</div>
                {s.requiredTools?.length ? (<div className="mt-1 flex items-center gap-1 text-[10px] text-gray-600"><span>依赖:</span>{s.requiredTools.map((t) => (<span key={t} className="font-mono bg-[#222] px-1 py-0.5 rounded">{t}</span>))}</div>) : null}
              </div>
              {onUpdate && <button onClick={() => startEdit(s)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-400 transition-opacity text-[10px]">编辑</button>}
              {onDelete && <button onClick={() => handleDelete(s.name)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-[10px]">删除</button>}
              <Toggle checked={!d} onChange={() => onToggle(s.name)} />
            </div>
          ); })}
        </Card>
      )}
    </div>
  );
}

function McpSection({ servers, configs, onAdd, onRemove, onToggle, getMcpServerTools, updateMcpServerToolConfig, searchMcpMarketplace, installFromMcpMarketplace, supportsStdio, onReload }: {
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
  searchMcpMarketplace?: (query: string) => Promise<{ servers: Array<{ id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }>; pagination: { totalCount: number } }>;
  installFromMcpMarketplace?: (qualifiedName: string) => Promise<{ success: boolean; error?: string }>;
  supportsStdio: boolean;
  onReload: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [mcpTab, setMcpTab] = useState<'config' | 'market'>('config');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, string[]>>({});
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'http'>(supportsStdio ? 'stdio' : 'http');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [marketQuery, setMarketQuery] = useState('');
  const [marketResults, setMarketResults] = useState<Array<{ id: string; qualifiedName: string; displayName: string; description: string; useCount: number; verified: boolean }>>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [installingName, setInstallingName] = useState<string | null>(null);

  const connectedNames = new Set(servers.map((s) => s.name));

  const toggleExpand = async (name: string) => {
    if (expandedServer === name) {
      setExpandedServer(null);
      return;
    }
    setExpandedServer(name);
    if (!serverTools[name] && getMcpServerTools) {
      const tools = await getMcpServerTools(name);
      setServerTools((prev) => ({ ...prev, [name]: tools }));
    }
  };

  const handleToggleTool = async (serverName: string, toolName: string, enable: boolean) => {
    const cfg = configs.find((c) => c.name === serverName);
    if (!cfg || !updateMcpServerToolConfig) return;
    const current = cfg.disabledTools ?? [];
    const disabledTools = enable ? current.filter((t) => t !== toolName) : [...current.filter((t) => t !== toolName), toolName];
    await updateMcpServerToolConfig(serverName, { disabledTools });
    onReload();
  };

  const handleApprovalMode = async (serverName: string, mode: 'auto' | 'ask' | 'deny') => {
    if (!updateMcpServerToolConfig) return;
    await updateMcpServerToolConfig(serverName, { approvalMode: mode });
    onReload();
  };

  const handleAdd = async () => {
    if (!onAdd || !formName.trim()) return;
    const config: McpServerConfig = {
      name: formName.trim(),
      transport: formTransport,
      enabled: true,
      ...(formTransport === 'stdio' ? { command: formCommand.trim(), args: formArgs.trim() ? formArgs.trim().split(/\s+/) : [] } : { url: formUrl.trim() }),
    };
    await onAdd(config);
    setFormName(''); setFormCommand(''); setFormArgs(''); setFormUrl('');
    setShowAdd(false);
    onReload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg text-white font-medium">MCP 服务器</h2>
          <p className="text-xs text-gray-500 mt-0.5">连接外部 MCP 服务器，扩展工具能力。</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 border-b border-[#2a2a2a]">
        <button onClick={() => setMcpTab('config')} className={cn('px-3 py-1.5 text-[12px] border-b-2 transition-colors', mcpTab === 'config' ? 'text-white border-cyan-500' : 'text-gray-500 border-transparent hover:text-gray-300')}>已配置</button>
        <button onClick={() => setMcpTab('market')} className={cn('px-3 py-1.5 text-[12px] border-b-2 transition-colors', mcpTab === 'market' ? 'text-white border-cyan-500' : 'text-gray-500 border-transparent hover:text-gray-300')}>市场</button>
      </div>

      {mcpTab === 'config' && (<>
        <div className="flex justify-end mb-3">
          {onAdd && !showAdd && (
            <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ 添加服务器</button>
          )}
        </div>

      {/* Configured servers with CRUD + tool permissions */}
      {configs.length > 0 && (
        <Card className="!p-0 divide-y divide-[#2a2a2a] mb-4">
          {configs.map((c) => (
            <div key={c.name}>
              <div className="px-4 py-3 flex items-center gap-3 group">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', c.enabled && connectedNames.has(c.name) ? 'bg-green-400' : c.enabled ? 'bg-yellow-500' : 'bg-gray-600')} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 font-mono">{c.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {c.transport === 'stdio' ? <span>stdio: <span className="font-mono">{c.command} {(c.args || []).join(' ')}</span></span> : <span>http: <span className="font-mono">{c.url}</span></span>}
                  </div>
                </div>
                {connectedNames.has(c.name) && (
                  <button onClick={() => toggleExpand(c.name)} className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors">
                    {expandedServer === c.name ? '收起' : '工具'}
                  </button>
                )}
                {onToggle && <Toggle checked={c.enabled} onChange={(v) => { onToggle(c.name, v); onReload(); }} />}
                {onRemove && <button onClick={async () => { await onRemove(c.name); onReload(); }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-[10px]">删除</button>}
              </div>

              {/* Expanded tool permissions */}
              {expandedServer === c.name && connectedNames.has(c.name) && (
                <div className="px-4 pb-3 border-t border-[#2a2a2a] bg-[#1a1a1a]/50">
                  {/* Approval mode */}
                  <div className="flex items-center gap-3 mt-2 mb-3">
                    <span className="text-[11px] text-gray-500">审批模式:</span>
                    <select
                      value={c.approvalMode ?? 'ask'}
                      onChange={(e) => handleApprovalMode(c.name, e.target.value as 'auto' | 'ask' | 'deny')}
                      className={cn(SELECT_CLS, '!py-1 !text-[11px]')}
                    >
                      <option value="auto">自动批准</option>
                      <option value="ask">需确认 (默认)</option>
                      <option value="deny">全部拒绝</option>
                    </select>
                  </div>

                  {/* Tool list */}
                  {(serverTools[c.name]?.length ?? 0) > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">工具列表</div>
                      {serverTools[c.name]?.map((tool) => {
                        const isDisabled = c.disabledTools?.includes(tool) ?? false;
                        return (
                          <div key={tool} className="flex items-center gap-2 py-1">
                            <Toggle
                              checked={!isDisabled}
                              onChange={(v) => handleToggleTool(c.name, tool, v)}
                            />
                            <span className={cn('text-[12px] font-mono', isDisabled ? 'text-gray-600 line-through' : 'text-gray-300')}>{tool}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-600 py-1">加载工具列表中...</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {configs.length === 0 && !showAdd && (
        <Card>
          <div className="text-center py-6">
            <p className="text-gray-600 text-sm mb-2">暂无已配置的 MCP 服务器</p>
            <p className="text-[11px] text-gray-600">点击上方按钮添加</p>
          </div>
        </Card>
      )}

      {/* Add form */}
      {showAdd && (
        <Card className="!border-cyan-900/50">
          <div className="text-sm text-cyan-400 font-medium mb-3">添加 MCP 服务器</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>名称</FieldLabel><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="my-server" className={INPUT_CLS} /></div>
              {supportsStdio ? (
                <div><FieldLabel>传输类型</FieldLabel><select value={formTransport} onChange={(e) => setFormTransport(e.target.value as 'stdio' | 'http')} className={SELECT_CLS}><option value="stdio">Stdio</option><option value="http">HTTP</option></select></div>
              ) : (
                <div><FieldLabel>传输类型</FieldLabel><div className="px-3 py-2 text-sm text-gray-500 bg-[#222] border border-[#333] rounded-lg">HTTP (仅支持)</div></div>
              )}
            </div>
            {formTransport === 'stdio' ? (
              <>
                <div><FieldLabel>命令</FieldLabel><input type="text" value={formCommand} onChange={(e) => setFormCommand(e.target.value)} placeholder="npx, uvx, node..." className={INPUT_CLS} /></div>
                <div><FieldLabel>参数（空格分隔）</FieldLabel><input type="text" value={formArgs} onChange={(e) => setFormArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-memory" className={INPUT_CLS} /></div>
              </>
            ) : (
              <div><FieldLabel>URL</FieldLabel><input type="text" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className={INPUT_CLS} /></div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleAdd} disabled={!formName.trim() || (formTransport === 'stdio' ? !formCommand.trim() : !formUrl.trim())} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors">添加</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300">取消</button>
            </div>
          </div>
        </Card>
      )}
      </>)}

      {/* Market tab */}
      {mcpTab === 'market' && (
        <div>
          {/* Search bar */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={marketQuery}
              onChange={(e) => setMarketQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchMcpMarketplace) {
                  setMarketLoading(true);
                  searchMcpMarketplace(marketQuery)
                    .then((r) => setMarketResults(r.servers))
                    .catch(() => setMarketResults([]))
                    .finally(() => setMarketLoading(false));
                }
              }}
              placeholder="搜索 MCP 服务器..."
              className="flex-1 text-sm text-gray-300 bg-[#171717] rounded-lg px-3 py-2 border border-[#2a2a2a] focus:border-cyan-600 outline-none placeholder:text-gray-600"
            />
            <button
              onClick={() => {
                if (!searchMcpMarketplace) return;
                setMarketLoading(true);
                searchMcpMarketplace(marketQuery)
                  .then((r) => setMarketResults(r.servers))
                  .catch(() => setMarketResults([]))
                  .finally(() => setMarketLoading(false));
              }}
              disabled={marketLoading || !searchMcpMarketplace}
              className="px-4 py-2 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              {marketLoading ? '搜索中...' : '搜索'}
            </button>
          </div>

          {/* Results */}
          {marketResults.length > 0 ? (
            <div className="space-y-2">
              {marketResults.map((s) => (
                <Card key={s.id} className="group">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200 font-medium">{s.displayName || s.qualifiedName}</span>
                        {s.verified && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">已验证</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                      <div className="text-[10px] text-gray-600 mt-1.5">
                        <span>{s.useCount.toLocaleString()} 次安装</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!installFromMcpMarketplace) return;
                        setInstallingName(s.qualifiedName);
                        try {
                          const res = await installFromMcpMarketplace(s.qualifiedName);
                          if (res.success) {
                            onReload();
                          } else {
                            console.error('Install failed:', res.error);
                          }
                        } finally {
                          setInstallingName(null);
                        }
                      }}
                      disabled={installingName === s.qualifiedName || !installFromMcpMarketplace}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-cyan-800 text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {installingName === s.qualifiedName ? '安装中...' : '安装'}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : marketLoading ? (
            <Card>
              <div className="text-center py-8 text-gray-600 text-sm">搜索中...</div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm mb-1">搜索 Smithery MCP 市场</p>
                <p className="text-[11px] text-gray-600">输入关键词后按回车或点击搜索</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PermissionsSection({ mode, onChange }: { mode: string; onChange: (m: string) => void }) {
  const modes: Array<{ id: string; label: string; desc: string }> = [
    { id: 'read_only', label: '只读', desc: 'Agent 只能读取文件，不能修改或执行命令' },
    { id: 'plan', label: '计划', desc: 'Agent 只做规划，不执行任何操作' },
    { id: 'default', label: '默认', desc: 'Agent 可读写文件和执行命令，需要确认危险操作' },
    { id: 'accept_edits', label: '接受编辑', desc: 'Agent 可直接编辑文件，执行命令需确认' },
    { id: 'auto', label: '全自动', desc: 'Agent 无需确认即可执行所有操作（谨慎使用）' },
  ];
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">权限</h2>
      <p className="text-xs text-gray-500 mb-6">控制 Agent 在执行操作时的权限范围。</p>
      <div className="space-y-2">{modes.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} className={cn('w-full text-left p-4 rounded-xl border transition-colors', m.id === mode ? 'border-cyan-700 bg-cyan-950/30' : 'border-[#2a2a2a] bg-[#1c1c1c] hover:border-[#333]')}>
          <div className="flex items-center gap-2 mb-1"><span className={cn('w-3 h-3 rounded-full border-2 flex items-center justify-center', m.id === mode ? 'border-cyan-500' : 'border-[#444]')}>{m.id === mode && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}</span><span className={cn('text-sm font-medium', m.id === mode ? 'text-cyan-300' : 'text-gray-300')}>{m.label}</span></div>
          <p className="text-[11px] text-gray-500 ml-5">{m.desc}</p>
        </button>
      ))}</div>
    </div>
  );
}

function MemorySection({ hasMemory, memoryText, entries, memoryInput, setMemoryInput, onAdd, onClear, onDeleteEntry }: {
  hasMemory: boolean; memoryText: string; entries: MemoryEntry[];
  memoryInput: string; setMemoryInput: (v: string) => void;
  onAdd: () => void; onClear: () => void;
  onDeleteEntry: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">记忆</h2>
      <p className="text-xs text-gray-500 mb-6">持久化的上下文记忆。Agent 在对话中会参考这些信息。</p>

      {/* Memory entries list */}
      {entries.length > 0 && (
        <Card className="!p-0 divide-y divide-[#2a2a2a] mb-4">
          {entries.map((e) => (
            <div key={e.key} className="px-4 py-3 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-300 whitespace-pre-wrap break-words">{e.content}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-600">
                    <span>{e.source}</span>
                    {e.timestamp && <span>{new Date(e.timestamp).toLocaleString()}</span>}
                  </div>
                </div>
                <button onClick={() => onDeleteEntry(e.key)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity flex-shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-4"><span className={cn('w-2 h-2 rounded-full', hasMemory ? 'bg-green-400' : 'bg-gray-600')} /><span className={cn('text-sm', hasMemory ? 'text-green-400' : 'text-gray-500')}>{hasMemory ? '已启用' : '暂无记忆'}</span></div>
        <div>
          <FieldLabel>添加新记忆</FieldLabel>
          <textarea value={memoryInput} onChange={(e) => setMemoryInput(e.target.value)} placeholder="输入你想让 Agent 记住的内容..." className="w-full text-xs text-gray-300 bg-[#171717] rounded-lg p-3 border border-[#2a2a2a] focus:border-cyan-600 outline-none placeholder:text-gray-600 resize-none h-24" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={onAdd} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">添加记忆</button>
            {hasMemory && <button onClick={onClear} className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors">清除所有记忆</button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function SearchSection({ endpoint, onChange, onSave }: { endpoint: string; onChange: (v: string) => void; onSave: () => void }) {
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">网页搜索</h2>
      <p className="text-xs text-gray-500 mb-6">配置搜索 API 端点后，Agent 可通过 web_search 工具搜索互联网。</p>
      <Card>
        <FieldLabel>搜索 API 端点</FieldLabel>
        <input type="url" value={endpoint} onChange={(e) => onChange(e.target.value)} placeholder="https://your-searxng-instance.com/search?format=json" className={INPUT_CLS} />
        <p className="mt-2 text-[10px] text-gray-600">端点需接受 <code className="font-mono bg-[#171717] px-1 py-0.5 rounded border border-[#2a2a2a]">?q=查询词</code> 并返回 JSON。推荐 SearXNG 自建实例。</p>
        <button onClick={onSave} className="mt-3 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">保存端点</button>
      </Card>
    </div>
  );
}

function AutomationSection({ hasSubagent, hasPlanning, tools }: { hasSubagent: boolean; hasPlanning: boolean; tools: ToolInfo[] }) {
  const planTools = useMemo(() => tools.filter((t) => t.name.startsWith('plan_')), [tools]);
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">自动化</h2>
      <p className="text-xs text-gray-500 mb-6">任务规划、子代理、生命周期钩子等高级自动化功能。</p>
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-200 font-medium">规划 (Planning)</span><Badge color={hasPlanning ? 'green' : 'gray'}>{hasPlanning ? '已启用' : '未启用'}</Badge></div>
        <div className="p-2.5 rounded-lg bg-[#171717] border border-[#2a2a2a]"><div className="space-y-1">
          {(planTools.length > 0 ? planTools : [{ name: 'plan_create', description: '创建多步骤计划' }, { name: 'plan_get_status', description: '查看计划和下一步' }, { name: 'plan_update_step', description: '更新步骤状态' }]).map((t) => (
            <div key={t.name} className="flex items-center gap-2 text-[11px]"><span className="w-1 h-1 rounded-full bg-green-400" /><span className="font-mono text-cyan-400">{t.name}</span><span className="text-gray-500">{t.description}</span></div>
          ))}
        </div></div>
      </Card>
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-200 font-medium">子代理 (Subagent)</span><Badge color={hasSubagent ? 'green' : 'gray'}>{hasSubagent ? '已启用' : '未启用'}</Badge></div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded bg-[#171717] border border-[#2a2a2a]"><span className="text-gray-500">最大迭代</span><span className="ml-2 font-mono text-gray-400">20</span></div>
          <div className="p-2 rounded bg-[#171717] border border-[#2a2a2a]"><span className="text-gray-500">超时时间</span><span className="ml-2 font-mono text-gray-400">120s</span></div>
        </div>
      </Card>
      <Card>
        <span className="text-sm text-gray-200 font-medium block mb-3">钩子 (Hooks)</span>
        <div className="grid grid-cols-2 gap-1.5">{[['session_start', '会话开始'], ['session_end', '会话结束'], ['pre_tool_use', '工具执行前'], ['post_tool_use', '工具执行后'], ['context_compact', '上下文压缩'], ['message_sent', '消息发送']].map(([ev, desc]) => (
          <div key={ev} className="flex items-center gap-2 text-[11px] p-1.5 rounded bg-[#171717] border border-[#2a2a2a]"><span className="font-mono text-cyan-400">{ev}</span><span className="text-gray-500">{desc}</span></div>
        ))}</div>
      </Card>
    </div>
  );
}
