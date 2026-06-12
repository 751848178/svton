import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { useChat, useSession, useAgentContext } from '@svton/agent-client';
import { type SlashCommand, type MentionItem } from '@svton/agent-ui';
import { Sidebar, type View } from '@/components/Sidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ChatContent } from '@/components/ChatContent';
import { useGitBranch } from '@/hooks/useGitBranch';

// Tauri v2 window drag — use startDragging() for reliable cross-platform support
let startDraggingFn: (() => Promise<void>) | null = null;
async function initDrag() {
  if (startDraggingFn) { startDraggingFn(); return; }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window' as string);
    const appWindow = getCurrentWindow();
    startDraggingFn = () => appWindow.startDragging();
    startDraggingFn();
  } catch { /* non-Tauri environment */ }
}
const handleDragStart = () => { initDrag(); };

interface ToolDefinition {
  name: string;
  description?: string;
}

interface SkillDefinition {
  name: string;
  description?: string;
  scope?: string;
}

export function MainLayout({ config, platform, models, currentModel, setCurrentModel, onReinit }: {
  config: AgentConfig;
  platform: TauriPlatform;
  models: { id: string; name: string; providerName: string }[];
  currentModel: string;
  setCurrentModel: (id: string) => void;
  onReinit?: (workingDir?: string) => void;
}) {
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession, updateProjectId } = useSession();
  const { status, abort, messages, send } = useChat();
  const { projectService } = useAgentContext();
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
        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-md bg-[#222] hover:bg-[#333] text-gray-400 hover:text-gray-200 border border-[#333] transition-colors"
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
          className="w-56 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl py-1 overflow-hidden max-h-80 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {modelGroups.map(([provider, ms], gi) => (
            <div key={provider}>
              {gi > 0 && <div className="border-t border-[#2a2a2a] my-1" />}
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

  // Automation and Skills data
  const tools = useMemo(() => (config.toolRegistry?.listDefinitions() ?? []) as ToolDefinition[], [config.toolRegistry]);
  const agentSkills = useMemo(() => (config.capabilities?.skillManager?.list() ?? []) as SkillDefinition[], [config.capabilities]);

  // Permission mode
  const [permissionMode, setPermissionMode] = useState<'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto'>(
    () => (config.capabilities?.permissionManager?.getMode() as any) ?? 'default'
  );
  const handlePermissionModeChange = useCallback(async (mode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto') => {
    setPermissionMode(mode);
    config.capabilities?.permissionManager?.setMode(mode);
    await platform.storage.set('agent:permission_mode', mode);
    // Sync planMode state: if user explicitly sets a non-plan mode, plan mode is off
    setPlanMode(mode === 'plan');
  }, [config, platform]);

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
  ], [create, send, config]);

  // Git branch + project name for input footer
  const workingDir = config?.workingDir || '/';
  const gitBranch = useGitBranch(platform, workingDir);
  const currentProject = projects.find((p) => p.id === currentProjectId);
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
    const tools = config.toolRegistry?.listDefinitions() ?? [];
    for (const t of tools.slice(0, 20)) {
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
      <div className="flex flex-col h-screen bg-black text-gray-100 font-mono">
        {/* Draggable spacer for macOS traffic light buttons */}
        <div
          onMouseDown={handleDragStart}
          className="h-9 flex-shrink-0 cursor-default select-none"
        />
        <SettingsPanel platform={platform} agentConfig={config} onBack={() => setView('chat')} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent text-gray-100 font-mono">
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-black">
        {/* Draggable title bar with session name */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-between h-10 px-4 border-b border-[#2a2a2a] bg-[#111] flex-shrink-0 select-none cursor-default"
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
            />
          )}
          {view === 'automation' && (
            <AutomationPanel tools={tools} onManage={() => setView('settings')} />
          )}
          {view === 'skills' && (
            <SkillsPanel skills={agentSkills} onManage={() => setView('settings')} />
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
            <div key={tool.name} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-3">
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

function SkillsPanel({ skills, onManage }: { skills: SkillDefinition[]; onManage?: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">技能</h2>
        {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
      </div>
      {skills.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无注册的技能</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.name} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium">{skill.name}</span>
                {skill.scope && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{skill.scope}</span>
                )}
              </div>
              {skill.description && <div className="text-xs text-gray-500 mt-1">{skill.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
