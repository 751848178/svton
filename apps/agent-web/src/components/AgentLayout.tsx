'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SlashCommand, type MentionItem, type ReasoningEffort } from '@svton/agent-ui';
import { useChat, useSession, useAgentContext } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import type { View } from './Sidebar';
import { Sidebar } from './Sidebar';
import { ChatContent } from './ChatContent';
import { MenuIcon } from './icons';
import {
  readConfigPermissionMode,
  readConfigPlanMode,
  readRestorablePermissionMode,
  toRestorablePermissionMode,
  type AgentPermissionMode,
  type RestorablePermissionMode,
} from './agent-permission-mode.utils';

interface AgentLayoutProps {
  config: AgentConfig;
  models: { id: string; name: string; providerName: string }[];
  currentModel: string;
  setCurrentModel: (id: string) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  dropRef: React.RefObject<HTMLDivElement | null>;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export function AgentLayout({
  config,
  models,
  currentModel,
  setCurrentModel,
  dropdownOpen,
  setDropdownOpen,
  dropRef,
  sidebarOpen,
  setSidebarOpen,
}: AgentLayoutProps) {
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession } = useSession();
  const { status, abort, messages, send } = useChat();
  const { platform, chatService } = useAgentContext();
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [view, setView] = useState<View>('chat');

  const selectedModel = models.find((m) => m.id === currentModel);
  const modelName = selectedModel?.name || currentModel;
  const modelProvider = selectedModel?.providerName || '';

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

  // Slash commands
  const slashCommands: SlashCommand[] = useMemo(() => [
    { name: 'new', description: '创建新对话', action: () => create() },
    { name: 'clear', description: '清空当前对话', action: () => create() },
    { name: 'review', description: '审查代码变更 — 对比分支/提交/未提交更改', action: () => { send('/review'); } },
    { name: 'agent', description: '切换 Agent 定义 — 用法: /agent <name>', action: () => {} },
    { name: 'help', description: '显示帮助信息', action: () => { send('请帮我了解你可以做什么，有哪些能力和工具'); } },
    { name: 'status', description: '查看当前状态和能力', action: () => {
      send(`当前 Agent 状态:\n- 模型: ${config.model}\n请简要介绍你的能力。`);
    }},
  ], [create, send, config]);

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

  const handleNavigate = useCallback((v: View) => {
    if (v === 'settings') {
      window.location.href = '/settings';
      return;
    }
    setView(v);
  }, []);

  // Automation and Skills data
  const tools = useMemo(() => config.toolRegistry?.listDefinitions() ?? [], [config.toolRegistry]);
  const agentSkills = useMemo(() => config.capabilities?.skillManager?.list() ?? [], [config.capabilities]);

  // ── Mention items (skills + tools, no files in browser) ──
  const mentionItems: MentionItem[] = useMemo(() => {
    const items: MentionItem[] = [];
    const skills = config.capabilities?.skillManager?.list() ?? [];
    for (const s of skills) {
      items.push({
        label: s.name,
        description: s.description,
        icon: <span className="text-purple-400 text-[10px]">✦</span>,
        category: 'skill',
      });
    }
    const toolDefs = config.toolRegistry?.listDefinitions() ?? [];
    for (const t of toolDefs.slice(0, 20)) {
      items.push({
        label: t.name,
        description: t.description,
        icon: <span className="text-cyan-400 text-[10px]">⚙</span>,
        category: 'tool',
      });
    }
    return items;
  }, [config.capabilities, config.toolRegistry]);

  const handleMentionSelect = useCallback((item: MentionItem): string => {
    return `@${item.label}`;
  }, []);

  // ── Permission mode ──
  const [permissionMode, setPermissionMode] = useState<AgentPermissionMode>(
    () => readConfigPermissionMode(config)
  );
  const handlePermissionModeChange = useCallback(async (mode: AgentPermissionMode) => {
    setPermissionMode(mode);
    config.capabilities?.permissionManager?.setMode(mode);
    await platform.storage.set('agent:permission_mode', mode);
    // Sync planMode state
    setPlanMode(mode === 'plan');
  }, [config, platform]);

  // ── Plan mode ──
  const [planMode, setPlanMode] = useState(() => {
    return readConfigPlanMode(config);
  });
  // ── Reasoning effort — applied to runtime via ChatService ──
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(undefined);
  const handleReasoningEffortChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    chatService?.setReasoningEffort(effort);
  }, [chatService]);
  const prePlanModeRef = useRef<RestorablePermissionMode>(readRestorablePermissionMode(config));
  useEffect(() => {
    const mode = readConfigPermissionMode(config);
    setPermissionMode(mode);
    setPlanMode(mode === 'plan');
    if (mode !== 'plan') {
      prePlanModeRef.current = toRestorablePermissionMode(mode);
    }
  }, [config]);
  const handlePlanModeChange = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const currentMode = config.capabilities?.permissionManager?.getMode();
      if (currentMode && currentMode !== 'plan') {
        prePlanModeRef.current = toRestorablePermissionMode(currentMode as AgentPermissionMode);
      }
      setPlanMode(true);
      setPermissionMode('plan');
      config.capabilities?.permissionManager?.setMode('plan');
      await platform.storage.set('agent:permission_mode', 'plan');
    } else {
      const restore = prePlanModeRef.current;
      setPlanMode(false);
      setPermissionMode(restore);
      config.capabilities?.permissionManager?.setMode(restore);
      await platform.storage.set('agent:permission_mode', restore);
    }
  }, [config, platform]);

  // ── Plugins ──
  const plugins = useMemo(() =>
    (config.capabilities?.pluginManager?.list() ?? []).map((p: any) => ({ name: p.name, enabled: p.enabled })),
  [config.capabilities]);
  const handlePluginToggle = useCallback(async (name: string, enabled: boolean) => {
    const pm = config.capabilities?.pluginManager;
    if (!pm) return;
    if (enabled) { await pm.enable(name); } else { await pm.disable(name); }
  }, [config.capabilities]);

  return (
    <div className="flex h-screen bg-black text-gray-100 font-mono">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={() => { create(); setView('chat'); }}
        onSwitchSession={switchTo}
        onDeleteSession={deleteSession}
        onNavigate={handleNavigate}
        activeView={view}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isMobileOpen={sidebarOpen}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile sidebar toggle (hidden on desktop) */}
        {!sidebarOpen && (
          <div className="md:hidden flex items-center px-3 py-2 border-b border-[#2a2a2a]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-gray-200 p-1.5 rounded-md hover:bg-[#2a2a2a]/60 transition-colors"
            >
              <MenuIcon />
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {(view === 'chat' || view === 'search') && (
            <ChatContent
              modelSelector={modelSelector}
              slashCommands={slashCommands}
              matchedSkills={matchedSkills}
              onAbort={abort}
              mentionItems={mentionItems}
              onMentionSelect={handleMentionSelect}
              permissionMode={permissionMode}
              onPermissionModeChange={handlePermissionModeChange}
              planMode={planMode}
              onPlanModeChange={handlePlanModeChange}
              plugins={plugins}
              onPluginToggle={handlePluginToggle}
              reasoningEffort={reasoningEffort}
              onReasoningEffortChange={handleReasoningEffortChange}
            />
          )}
          {view === 'automation' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg text-white font-light mb-4">自动化任务</h2>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-sm mb-2">自动化任务需要桌面端运行</p>
                <p className="text-gray-600 text-xs">定时任务和事件触发需要后台进程支持，请在 Svton Desktop 中使用此功能。</p>
              </div>
            </div>
          )}
          {view === 'skills' && (
            <SkillsPanel skills={agentSkills} onManage={() => window.location.href = '/settings'} />
          )}
          {view === 'agents' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg text-white font-light mb-4">自定义 Agents</h2>
              {(() => {
                const mgr = config.capabilities?.agentDefinitionManager;
                if (!mgr) return <p className="text-gray-500 text-sm">Agent 管理器未初始化</p>;
                const agents = mgr.list();
                return (
                  <div className="space-y-2">
                    {agents.length === 0 ? (
                      <p className="text-gray-500 text-sm">暂无自定义 Agent。在对话中输入 /agent &lt;name&gt; 切换。</p>
                    ) : agents.map((a: any) => (
                      <div key={a.name} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{a.title || a.name}</span>
                          {a.icon && <span className="text-xs">{a.icon}</span>}
                        </div>
                        {a.description && <div className="text-xs text-gray-500 mt-1">{a.description}</div>}
                        {a.model && <div className="text-[10px] text-gray-600 mt-1">Model: {a.model}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {view === 'integrations' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg text-white font-light mb-4">集成</h2>
              <p className="text-[11px] text-gray-500 mb-4">配置 Slack、Linear 等第三方集成。配置 API Key 后，Agent 可直接调用对应工具。</p>
              {(() => {
                const intMgr = (config as any)?.capabilities?.integrationManager;
                if (!intMgr) return (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400 text-sm mb-2">集成管理器未初始化</p>
                    <button onClick={() => window.location.href = '/settings'} className="mt-3 px-3 py-1 text-[11px] text-cyan-400 hover:text-cyan-300 border border-cyan-900/50 rounded-md">前往设置 →</button>
                  </div>
                );
                const integrations = intMgr.list?.() ?? [];
                return (
                  <div className="space-y-2">
                    {integrations.length === 0 ? (
                      <p className="text-gray-500 text-sm">暂无已注册集成。</p>
                    ) : integrations.map((intg: any) => (
                      <div key={intg.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm text-white font-medium">{intg.name}</span>
                          {intg.description && <p className="text-xs text-gray-500 mt-0.5">{intg.description}</p>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${intg.enabled ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                          {intg.enabled ? '已启用' : '未启用'}
                        </span>
                      </div>
                    ))}
                    <button onClick={() => window.location.href = '/settings'} className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300">在设置中配置凭证 →</button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Automation panel ──────────────────────────────────────

interface ToolDefinition {
  name: string;
  description?: string;
}

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

interface SkillDefinition {
  name: string;
  description?: string;
  scope?: string;
}

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
