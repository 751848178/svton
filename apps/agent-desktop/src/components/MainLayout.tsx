import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { useChat, useSession, useAgentContext } from '@svton/agent-client';
import { type SlashCommand, type MentionItem, type ReasoningEffort } from '@svton/agent-ui';
import { Sidebar, type View } from '@/components/Sidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ChatContent } from '@/components/ChatContent';
import { useGitBranch } from '@/hooks/useGitBranch';
import { PopoutIcon } from '@/components/icons';
import type { AgentExtra } from '@/lib/agent-setup';
import {
  AutomationPanelExtra,
  WorktreePanelExtra,
  AgentsPanelExtra,
  IntegrationsPanelView,
  ChroniclePanelExtra,
} from '@/components/ExtraPanels';
import { startDragging, toggleMaximize } from '@/lib/window-controls';

interface ToolDefinition {
  name: string;
  description?: string;
}

interface SkillDefinition {
  name: string;
  description?: string;
  scope?: string;
}

export function MainLayout({ config, platform, models, currentModel, setCurrentModel, onReinit, extra }: {
  config: AgentConfig;
  platform: TauriPlatform;
  models: { id: string; name: string; providerName: string }[];
  currentModel: string;
  setCurrentModel: (id: string) => void;
  onReinit?: (workingDir?: string) => void;
  /** Extra agent managers (chronicle, automation, integration, worktree, imageGen) — currently for future UI panels. */
  extra?: AgentExtra;
}) {
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession, updateProjectId } = useSession();
  const { status, abort, messages, send } = useChat();
  const { projectService, chatService } = useAgentContext();
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [view, setView] = useState<View>('chat');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === currentModel);
  const modelName = selectedModel?.name || currentModel;
  const modelProvider = selectedModel?.providerName || '';

  // Current session info for header
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const sessionTitle = currentSession?.title || '新对话';

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [dropdownOpen]);

  // Memoize model groups — avoids recalculating on every render (R2 fix)
  const modelGroups = useMemo(() => {
    const groups: Record<string, { id: string; name: string; providerName: string }[]> = {};
    for (const m of models) {
      (groups[m.providerName] ??= []).push(m);
    }
    return Object.entries(groups);
  }, [models]);

  // Model selector
  const [modelDropPos, setModelDropPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  const modelSelector = (
    <div ref={dropRef} className="relative flex-shrink-0">
      <button
        onClick={() => {
          if (!dropdownOpen && dropRef.current) {
            const rect = dropRef.current.getBoundingClientRect();
            setModelDropPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
          }
          setDropdownOpen(!dropdownOpen);
        }}
        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-md bg-[#2a2a2a] hover:bg-[#333] text-gray-400 hover:text-gray-200 border border-[#333] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-gray-500">
          <circle cx="8" cy="8" r="3" />
        </svg>
        <span className="max-w-[100px] truncate">{modelProvider ? `${modelProvider} · ${modelName}` : modelName}</span>
        <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor" className="text-gray-500">
          <path d="M3 5l3 3 3-3H3z" />
        </svg>
      </button>
      {dropdownOpen && (
        <div
          style={{ position: 'fixed', left: modelDropPos.left, bottom: modelDropPos.bottom, zIndex: 9999 }}
          className="w-56 bg-[#2a2a2a] rounded-lg border border-[#383838] shadow-xl py-1 overflow-hidden max-h-80 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {modelGroups.map(([provider, ms], gi) => (
            <div key={provider}>
              {gi > 0 && <div className="border-t border-[#383838] my-1" />}
              <div className="px-3 py-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                {provider}
              </div>
              {ms.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => { setCurrentModel(m.id); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    m.id === currentModel
                      ? 'text-white bg-[#2a2a2a] font-medium'
                      : 'text-gray-400 hover:bg-[#2a2a2a]/60 hover:text-gray-200'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Skill matching — key off messages length to avoid per-token recalculation (R3 fix)
  const messageCount = messages.length;
  useEffect(() => {
    const skills = config.capabilities?.skillManager?.list() ?? [];
    if (!skills.length) { setMatchedSkills([]); return; }
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) { setMatchedSkills([]); return; }
    const matched = skills.filter((s) => {
      const keywords = s.description.toLowerCase().split(/\s+/);
      const msg = lastUserMsg.content.toLowerCase();
      return keywords.some((kw) => kw.length > 3 && msg.includes(kw));
    }).map((s) => s.name);
    setMatchedSkills(matched);
  }, [messageCount, config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation handler — desktop shows settings inline
  const handleNavigate = useCallback((v: View) => {
    setView(v);
  }, []);

  // Project handlers
  const handleOpenProjectFolder = useCallback(async () => {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      const folderPath = await invoke('dialog_open_folder') as string | null;
      if (!folderPath) return;
      // Extract project name from path
      const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const name = parts[parts.length - 1] || 'Project';
      const project = await projectService.createProject(name, folderPath);
      await projectService.switchProject(project.id);
      // Update working dir and reinit
      await platform.storage.set('agent:workingDir', folderPath);
      onReinit?.(folderPath);
    } catch (err) {
      console.error('Failed to open project folder:', err);
    }
  }, [projectService, platform, onReinit]);

  const handleSwitchProject = useCallback(async (id: string | null) => {
    await projectService.switchProject(id);
    const project = id ? projectService.getProjectById(id) : undefined;
    const newDir = project?.path || platform.process.getEnv('HOME') || '/';
    await platform.storage.set('agent:workingDir', newDir);

    // If current session has no messages (new/empty chat), associate it with the selected project
    if (currentSessionId && messages.length === 0) {
      await updateProjectId(currentSessionId, id ?? undefined);
    }

    onReinit?.(newDir);
  }, [projectService, platform, onReinit, currentSessionId, messages.length, updateProjectId]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await projectService.deleteProject(id);
    if (projectService.currentProjectId === null) {
      await platform.storage.set('agent:workingDir', '/');
      onReinit?.('/');
    }
  }, [projectService, platform, onReinit]);

  // Pop out the current session into a secondary window
  const handlePopout = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('popout_session', { sessionId: currentSessionId });
    } catch (e) {
      console.error('Popout failed:', e);
    }
  }, [currentSessionId]);

  // Automation and Skills data
  const tools = useMemo(() => (config.toolRegistry?.listDefinitions() ?? []) as ToolDefinition[], [config.toolRegistry]);
  const agentSkills = useMemo(() => (config.capabilities?.skillManager?.list() ?? []) as SkillDefinition[], [config.capabilities]);

  // Permission mode — declared BEFORE handlers that reference setPermissionMode/setPlanMode
  const [permissionMode, setPermissionMode] = useState<'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto'>(
    () => (config.capabilities?.permissionManager?.getMode() as any) ?? 'default'
  );

  // Plan mode — initialize from permission manager state (sync with stored mode)
  const [planMode, setPlanMode] = useState(() => {
    const savedMode = config.capabilities?.permissionManager?.getMode();
    return savedMode === 'plan';
  });
  // Track the mode that was active before plan mode was enabled, so we can restore it
  const prePlanModeRef = useRef<'read_only' | 'default' | 'accept_edits' | 'auto'>(
    (() => {
      const m = config.capabilities?.permissionManager?.getMode();
      return (m === 'plan' ? 'default' : m) as 'read_only' | 'default' | 'accept_edits' | 'auto';
    })()
  );

  // Reasoning effort — applied to the runtime via ChatService
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(undefined);

  // P1-11: Sync local state when agent is re-initialized (model switch, reinit)
  useEffect(() => {
    const mode = config.capabilities?.permissionManager?.getMode() as any;
    if (mode) {
      setPermissionMode(mode);
      setPlanMode(mode === 'plan');
    }
  }, [config]);

  const handlePermissionModeChange = useCallback(async (mode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto') => {
    setPermissionMode(mode);
    config.capabilities?.permissionManager?.setMode(mode);
    await platform.storage.set('agent:permission_mode', mode);
    setPlanMode(mode === 'plan');
  }, [config, platform]);

  const handleReasoningEffortChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    chatService?.setReasoningEffort(effort);
  }, [chatService]);

  const handlePlanModeChange = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Save current mode before entering plan mode (but not 'plan' itself)
      const currentMode = config.capabilities?.permissionManager?.getMode();
      if (currentMode && currentMode !== 'plan') {
        prePlanModeRef.current = currentMode as 'read_only' | 'default' | 'accept_edits' | 'auto';
      }
      setPlanMode(true);
      setPermissionMode('plan');
      config.capabilities?.permissionManager?.setMode('plan');
      await platform.storage.set('agent:permission_mode', 'plan');
    } else {
      // Restore the mode that was active before plan mode
      const restore = prePlanModeRef.current;
      setPlanMode(false);
      setPermissionMode(restore);
      config.capabilities?.permissionManager?.setMode(restore);
      await platform.storage.set('agent:permission_mode', restore);
    }
  }, [config, platform]);

  // Plugins
  const plugins = useMemo(() =>
    (config.capabilities?.pluginManager?.list() ?? []).map((p: any) => ({ name: p.name, enabled: p.enabled })),
  [config.capabilities]);
  const handlePluginToggle = useCallback(async (name: string, enabled: boolean) => {
    const pm = config.capabilities?.pluginManager;
    if (!pm) return;
    if (enabled) { await pm.enable(name); } else { await pm.disable(name); }
  }, [config.capabilities]);

  // Get reactive project data
  const projects = projectService.projects ?? [];
  const currentProjectId = projectService.currentProjectId ?? null;

  // Slash commands
  const slashCommands: SlashCommand[] = useMemo(() => [
    { name: 'new', description: '创建新对话', action: () => create() },
    { name: 'clear', description: '清空当前对话', action: () => create() },
    { name: 'help', description: '显示帮助信息', action: () => { send('请帮我了解你可以做什么，有哪些能力和工具'); } },
    { name: 'status', description: '查看当前状态和能力', action: () => {
      send(`当前 Agent 状态:\n- 模型: ${config.model}\n请简要介绍你的能力。`);
    }},
    { name: 'review', description: '审查代码变更 — 对比分支/提交/未提交更改', action: () => { send('请帮我审查当前的代码变更。先用 git diff 查看未提交的更改，再分析每个变更的质量、潜在风险和改进建议。'); } },
    { name: 'agent', description: '切换 Agent 定义 — 用法: /agent <name>', action: () => { send('请列出当前可用的 Agent 定义，并说明各自的适用场景。'); } },
  ], [create, send, config]);

  // Git branch + project name for input footer
  const workingDir = config?.workingDir || '/';
  const currentProject = projects.find((p) => p.id === currentProjectId);
  // Use project path when available, fallback to config working dir
  const effectiveWorkingDir = currentProject?.path || workingDir;
  const gitBranch = useGitBranch(platform, effectiveWorkingDir);
  const projectName = currentProject?.name ?? null;

  // Mention items for @ references — categorized: skills, tools, files
  const [mentionFileCache, setMentionFileCache] = useState<MentionItem[]>([]);
  const mentionItems: MentionItem[] = useMemo(() => {
    const items: MentionItem[] = [];
    // Skills
    const skills = config.capabilities?.skillManager?.list() ?? [];
    for (const s of skills) {
      items.push({
        label: s.name,
        description: s.description,
        icon: <span className="text-purple-400 text-[10px]">✦</span>,
        category: 'skill',
      });
    }
    // Tools
    const toolDefs = config.toolRegistry?.listDefinitions() ?? [];
    for (const t of toolDefs.slice(0, 20)) {
      items.push({
        label: t.name,
        description: t.description,
        icon: <span className="text-cyan-400 text-[10px]">⚙</span>,
        category: 'tool',
      });
    }
    // Files from working directory
    items.push(...mentionFileCache);
    return items;
  }, [config.capabilities, config.toolRegistry, mentionFileCache]);

  // Load top-level files from working directory for mention suggestions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dir = config?.workingDir || '/';
        const entries = await platform.fs.listDir(dir);
        if (cancelled) return;
        const fileItems: MentionItem[] = entries.slice(0, 30).map((entry) => ({
          label: entry.name,
          description: entry.isFile ? '文件' : '目录',
          icon: entry.isFile
            ? <span className="text-gray-400 text-[10px]">📄</span>
            : <span className="text-yellow-400 text-[10px]">📁</span>,
          category: (entry.isFile ? 'file' : 'folder') as 'file' | 'folder',
        }));
        setMentionFileCache(fileItems);
      } catch {
        // Directory not readable — skip file mentions
      }
    })();
    return () => { cancelled = true; };
  }, [config?.workingDir, platform.fs]);

  const handleMentionSelect = useCallback((item: MentionItem): string => {
    return `@${item.label}`;
  }, []);

  // Settings: full-screen like web /settings route — no Sidebar or title bar
  if (view === 'settings') {
    return (
      <div className="flex flex-col h-screen bg-[#212121] text-gray-100">
        {/* Draggable spacer for macOS traffic light buttons */}
        <div
          onMouseDown={() => startDragging()}
          onDoubleClick={() => toggleMaximize()}
          className="h-9 flex-shrink-0 cursor-default select-none"
        />
        <SettingsPanel platform={platform} agentConfig={config} extra={extra} onBack={() => setView('chat')} onReinit={onReinit} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#212121] text-gray-100">
      <Sidebar
        config={config}
        sessions={sessions}
        currentSessionId={currentSessionId}
        projects={projects}
        currentProjectId={currentProjectId}
        onNewChat={() => { create(); setView('chat'); }}
        onSwitchSession={switchTo}
        onDeleteSession={deleteSession}
        onNavigate={handleNavigate}
        onSwitchProject={handleSwitchProject}
        onOpenProjectFolder={handleOpenProjectFolder}
        onDeleteProject={handleDeleteProject}
        activeView={view}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1e1e1e]">
        {/* Draggable title bar with session name */}
        <div
          onMouseDown={() => startDragging()}
          onDoubleClick={() => toggleMaximize()}
          className="flex items-center justify-between h-10 px-4 border-b border-[#333] bg-[#252525] flex-shrink-0 select-none cursor-default"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-400 truncate max-w-[200px]">{sessionTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {projectName && (
              <span className="text-[10px] text-gray-600">{projectName}</span>
            )}
            {gitBranch && (
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                {gitBranch}
              </span>
            )}
            {currentSessionId && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handlePopout}
                title="在新窗口中打开此会话"
                className="flex items-center justify-center w-6 h-6 rounded text-gray-600 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                <PopoutIcon />
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {(view === 'chat' || view === 'search') && (
            <ChatContent
              modelSelector={modelSelector}
              slashCommands={slashCommands}
              matchedSkills={matchedSkills}
              onAbort={abort}
              permissionMode={permissionMode}
              onPermissionModeChange={handlePermissionModeChange}
              planMode={planMode}
              onPlanModeChange={handlePlanModeChange}
              plugins={plugins}
              onPluginToggle={handlePluginToggle}
              gitBranch={gitBranch || null}
              projectName={projectName}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              currentProjectId={currentProjectId}
              onSelectProject={handleSwitchProject}
              mentionItems={mentionItems}
              onMentionSelect={handleMentionSelect}
              reasoningEffort={reasoningEffort}
              onReasoningEffortChange={handleReasoningEffortChange}
            />
          )}
          {view === 'automation' && (
            <AutomationPanelExtra automationManager={extra?.automationManager} onManage={() => setView('settings')} onTrigger={(prompt) => { send(prompt); setView('chat'); }} />
          )}
          {view === 'skills' && (
            <SkillsPanel skills={agentSkills} platform={platform} onManage={() => setView('settings')} onReinit={onReinit} />
          )}
          {view === 'plugins' && (
            <PluginsPanel config={config} platform={platform} tools={tools} />
          )}
          {view === 'agents' && (
            <AgentsPanelExtra config={config} onManage={() => setView('settings')} onSwitchAgent={(name) => { send(`/agent ${name}`); setView('chat'); }} />
          )}
          {view === 'worktrees' && (
            <WorktreePanelExtra
              worktreeManager={extra?.worktreeManager ?? config.capabilities?.worktreeManager}
              workingDir={effectiveWorkingDir}
              onManage={() => setView('settings')}
            />
          )}
          {view === 'integrations' && (
            <IntegrationsPanelView integrationManager={extra?.integrationManager} onManage={() => setView('settings')} />
          )}
          {view === 'chronicle' && (
            <ChroniclePanelExtra chronicleManager={extra?.chronicleManager} onManage={() => setView('settings')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Automation panel ──────────────────────────────────────

function AutomationPanel({ tools, onManage }: { tools: ToolDefinition[]; onManage?: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">自动化工具</h2>
        {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
      </div>
      {tools.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无注册的工具</p>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div key={tool.name} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3">
              <div className="text-sm text-white font-medium">{tool.name}</div>
              {tool.description && <div className="text-xs text-gray-500 mt-1">{tool.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skills panel ──────────────────────────────────────────

function SkillsPanel({ skills, platform, onManage, onReinit }: { skills: SkillDefinition[]; platform: TauriPlatform; onManage?: () => void; onReinit?: (workingDir?: string) => void }) {
  const [search, setSearch] = useState('');
  const [disabledSkills, setDisabledSkills] = useState<Set<string>>(new Set());

  useEffect(() => {
    platform.storage.get<string[]>('agent:disabled_skills').then(v => {
      if (Array.isArray(v)) setDisabledSkills(new Set(v));
    }).catch(() => {});
  }, [platform.storage]);

  const toggleSkill = useCallback(async (name: string) => {
    const next = new Set(disabledSkills);
    if (next.has(name)) next.delete(name); else next.add(name);
    setDisabledSkills(next);
    await platform.storage.set('agent:disabled_skills', Array.from(next));
    // Persist the change, then rebuild the runtime so the running
    // SkillManager picks up the new disabled set immediately. Without this,
    // a disabled skill keeps matching in findRelevant until next launch.
    onReinit?.();
  }, [disabledSkills, platform.storage, onReinit]);

  // Categorize: plugin skills (scope includes 'plugin') vs workspace/personal
  const filtered = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q))
    );
  }, [skills, search]);

  const workspaceSkills = filtered.filter(s => !s.scope?.includes('plugin'));
  const pluginSkills = filtered.filter(s => s.scope?.includes('plugin'));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg text-white font-light">技能</h2>
        <div className="flex items-center gap-2">
          {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mb-4">管理项目级与用户级技能。启用后可在聊天里通过 $skill-name 使用。</p>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#383838] mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索技能..."
          className="flex-1 bg-transparent text-[12px] text-gray-300 placeholder:text-gray-600 outline-none"
        />
      </div>

      {skills.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">暂无注册的技能</p>
      ) : (
        <>
          {/* Workspace & Personal Skills */}
          {workspaceSkills.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">工作区与个人技能</div>
              <div className="space-y-2">
                {workspaceSkills.map((skill) => {
                  const isDisabled = disabledSkills.has(skill.name);
                  return (
                    <div key={skill.name} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isDisabled ? 'text-gray-600' : 'text-white'}`}>{skill.name}</span>
                          {skill.scope && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333] text-gray-500">{skill.scope === 'user' ? '个人' : skill.scope}</span>
                          )}
                          {!isDisabled && (
                            <span className="text-[9px] text-gray-600 font-mono">${skill.name}</span>
                          )}
                        </div>
                        {skill.description && <div className={`text-xs mt-0.5 truncate ${isDisabled ? 'text-gray-700' : 'text-gray-500'}`}>{skill.description}</div>}
                      </div>
                      <Toggle enabled={!isDisabled} onChange={() => toggleSkill(skill.name)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plugin Skills */}
          {pluginSkills.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Plugin 技能</div>
              <p className="text-[10px] text-gray-600 mb-2">由插件注册，修改请到对应插件中进行。</p>
              <div className="space-y-2">
                {pluginSkills.map((skill) => {
                  const isDisabled = disabledSkills.has(skill.name);
                  return (
                    <div key={skill.name} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isDisabled ? 'text-gray-600' : 'text-white'}`}>{skill.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">Plugin</span>
                        </div>
                        {skill.description && <div className={`text-xs mt-0.5 truncate ${isDisabled ? 'text-gray-700' : 'text-gray-500'}`}>{skill.description}</div>}
                      </div>
                      <Toggle enabled={!isDisabled} onChange={() => toggleSkill(skill.name)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">没有找到匹配的技能</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Plugins panel ─────────────────────────────────────────

const COMPUTER_USE_TOOLS = ['screenshot', 'mouse_click', 'mouse_double_click', 'mouse_move', 'mouse_down', 'mouse_up', 'mouse_drag', 'scroll', 'keyboard_type_text', 'keyboard_press_key'];
const CHROME_CDP_TOOLS = ['chrome_navigate', 'chrome_screenshot', 'chrome_click', 'chrome_type', 'chrome_evaluate', 'chrome_get_content'];

function PluginsPanel({ config, platform, tools }: { config: AgentConfig; platform: TauriPlatform; tools: ToolDefinition[] }) {
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<{ accessibility: boolean; screen_recording: boolean } | null>(null);
  const [cdpConnected, setCdpConnected] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const disabled = await platform.storage.get<string[]>('agent:disabled_tools') ?? [];
      setDisabledTools(new Set(disabled));
      try {
        const api = await import('@tauri-apps/api/core' as string);
        const invoke = (api as any).invoke;
        setPermissions(await invoke('check_macos_permissions'));
        const cdp = await invoke('check_chrome_cdp');
        setCdpConnected(cdp.connected);
      } catch { setPermissions({ accessibility: true, screen_recording: true }); }
    })();
  }, [platform.storage]);

  useEffect(() => {
    const onFocus = async () => {
      try {
        const api = await import('@tauri-apps/api/core' as string);
        const invoke = (api as any).invoke;
        setPermissions(await invoke('check_macos_permissions'));
        const cdp = await invoke('check_chrome_cdp');
        setCdpConnected(cdp.connected);
      } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const toggleGroup = useCallback(async (names: string[], enable: boolean) => {
    const next = new Set(disabledTools);
    enable ? names.forEach(n => next.delete(n)) : names.forEach(n => next.add(n));
    setDisabledTools(next);
    await platform.storage.set('agent:disabled_tools', Array.from(next));
    const registry = config.toolRegistry;
    if (registry && !enable) names.forEach(n => registry.unregister(n));
  }, [disabledTools, platform.storage, config.toolRegistry]);

  const toggleTool = useCallback(async (name: string) => {
    const next = new Set(disabledTools);
    next.has(name) ? next.delete(name) : next.add(name);
    setDisabledTools(next);
    await platform.storage.set('agent:disabled_tools', Array.from(next));
    if (config.toolRegistry && next.has(name)) config.toolRegistry.unregister(name);
  }, [disabledTools, platform.storage, config.toolRegistry]);

  const requestPerm = useCallback(async (type: 'accessibility' | 'screen_recording') => {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const invoke = (api as any).invoke;
      await invoke(type === 'accessibility' ? 'request_accessibility_permission' : 'request_screen_recording_permission');
      await new Promise(r => setTimeout(r, 500));
      await invoke('open_system_settings', { pane: type });
    } catch {}
  }, []);

  const launchChrome = useCallback(async () => {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      await (api as any).invoke('launch_chrome_debug');
      await new Promise(r => setTimeout(r, 2000));
      const cdp = await (api as any).invoke('check_chrome_cdp');
      setCdpConnected(cdp.connected);
    } catch {}
  }, []);

  const [extConnected, setExtConnected] = useState<boolean | null>(null);
  const detectExtension = useCallback(async () => {
    try {
      // Check WebSocket relay connection via Tauri command
      const api: any = await import('@tauri-apps/api/core' as string);
      const connected = await api.invoke('check_extension_connected');
      setExtConnected(connected === true);
    } catch {
      // Fallback: HTTP ping
      try {
        const resp = await fetch('http://localhost:9223/ping', { method: 'GET', signal: AbortSignal.timeout(2000) });
        setExtConnected(resp.ok);
      } catch {
        setExtConnected(false);
      }
    }
  }, []);

  const handleInstallExtension = useCallback(async () => {
    try {
      const api: any = await import('@tauri-apps/api/core' as string);

      // 1. Export extension to temp dir and open in Finder
      const extPath = await api.invoke('export_chrome_extension');

      // 2. Open Chrome extensions page after a short delay
      setTimeout(async () => {
        try {
          await api.invoke('plugin:shell|open', { path: 'chrome://extensions' });
        } catch {
          // shell open might not allow chrome:// URL — try opening Chrome directly
          try {
            window.open('chrome://extensions', '_blank');
          } catch { /* ignore */ }
        }
      }, 1000);
    } catch (e) {
      console.error('Failed to export extension:', e);
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg text-white font-light mb-4">插件管理</h2>

      {/* System permissions */}
      {permissions && (
        <div className="mb-6 space-y-2">
          <h3 className="text-[13px] text-gray-400 font-medium mb-2">系统权限</h3>
          {[
            { key: 'accessibility' as const, label: '辅助功能', desc: '鼠标和键盘控制需要此权限', granted: permissions.accessibility },
            { key: 'screen_recording' as const, label: '屏幕录制', desc: '截图功能需要此权限', granted: permissions.screen_recording },
          ].map(p => (
            <div key={p.key} className="flex items-center justify-between bg-[#2a2a2a] border border-[#383838] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${p.granted ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div><div className="text-sm text-white">{p.label}</div><div className="text-[11px] text-gray-500">{p.desc}</div></div>
              </div>
              {p.granted ? <span className="text-[11px] text-green-500">已授权</span> : <button onClick={() => requestPerm(p.key)} className="px-3 py-1 text-[11px] text-white bg-[#3B82F6] hover:bg-[#60A5FA] rounded-md transition-colors">请求权限</button>}
            </div>
          ))}
        </div>
      )}

      {/* Chrome Connection — Extension (preferred) + Launch Parameter (fallback) */}
      <div className="mb-6 space-y-2">
        <h3 className="text-[13px] text-gray-400 font-medium mb-2">Chrome 连接</h3>

        {/* Method 1: Chrome Extension (recommended) */}
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${extConnected === true ? 'bg-green-500' : extConnected === false ? 'bg-gray-500' : 'bg-gray-600'}`} />
              <div>
                <div className="text-sm text-white">Chrome 扩展 <span className="text-[10px] text-cyan-400 ml-1">推荐</span></div>
                <div className="text-[11px] text-gray-500">{extConnected === true ? '扩展已连接' : extConnected === false ? '扩展未连接' : '点击检测扩展连接'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {extConnected ? (
                <span className="text-[11px] text-green-500">已连接</span>
              ) : (
                <>
                  <button onClick={detectExtension} className="px-2 py-1 text-[11px] text-gray-300 border border-[#333] rounded-md hover:bg-[#2a2a2a]">检测</button>
                  <button onClick={handleInstallExtension} className="px-2 py-1 text-[11px] text-blue-400 hover:text-blue-300">安装扩展 →</button>
                </>
              )}
            </div>
          </div>
          {extConnected === false && (
            <div className="text-[10px] text-gray-600 mt-2 space-y-0.5">
              <p>1. 点击「安装扩展」打开扩展文件夹</p>
              <p>2. Chrome 打开 chrome://extensions</p>
              <p>3. 开启右上角「开发者模式」</p>
              <p>4. 点击「加载已解压的扩展程序」，选择打开的文件夹</p>
            </div>
          )}
        </div>

        {/* Method 2: Launch Parameter (fallback) */}
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${cdpConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              <div>
                <div className="text-sm text-gray-400">启动参数 <span className="text-[10px] text-gray-600 ml-1">备用</span></div>
                <div className="text-[11px] text-gray-500">{cdpConnected ? 'Chrome 已连接 (端口 9222)' : '未启动调试端口'}</div>
              </div>
            </div>
            {cdpConnected ? (
              <span className="text-[11px] text-green-500">已连接</span>
            ) : (
              <button onClick={launchChrome} className="px-3 py-1 text-[11px] text-gray-300 border border-[#333] rounded-md hover:bg-[#2a2a2a]">启动 Chrome</button>
            )}
          </div>
        </div>
      </div>

      {/* Computer Use */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] text-gray-400 font-medium">Computer Use</h3>
          <Toggle enabled={COMPUTER_USE_TOOLS.some(t => !disabledTools.has(t))} onChange={(v) => toggleGroup(COMPUTER_USE_TOOLS, v)} />
        </div>
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg divide-y divide-[#252525]">
          {COMPUTER_USE_TOOLS.map(name => (
            <div key={name} className="flex items-center justify-between px-4 py-2">
              <span className="text-[13px] text-gray-300">{name}</span>
              <Toggle enabled={!disabledTools.has(name)} onChange={() => toggleTool(name)} />
            </div>
          ))}
        </div>
      </div>

      {/* Chrome CDP Tools */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] text-gray-400 font-medium">Chrome CDP</h3>
          <Toggle enabled={CHROME_CDP_TOOLS.some(t => !disabledTools.has(t))} onChange={(v) => toggleGroup(CHROME_CDP_TOOLS, v)} />
        </div>
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg divide-y divide-[#252525]">
          {CHROME_CDP_TOOLS.map(name => (
            <div key={name} className="flex items-center justify-between px-4 py-2">
              <span className="text-[13px] text-gray-300">{name}</span>
              <Toggle enabled={!disabledTools.has(name)} onChange={() => toggleTool(name)} />
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-600">禁用工具在下次新会话时完全生效。</p>
    </div>
  );
}

// ── Toggle ──────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[#3B82F6]' : 'bg-[#333]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
