import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { useChat, useSession } from '@svton/agent-client';
import { type SlashCommand } from '@svton/agent-ui';
import { Sidebar, type View } from '@/components/Sidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ChatContent } from '@/components/ChatContent';

interface ToolDefinition {
  name: string;
  description?: string;
}

interface SkillDefinition {
  name: string;
  description?: string;
  scope?: string;
}

export function MainLayout({ config, platform, models, currentModel, setCurrentModel }: {
  config: AgentConfig;
  platform: TauriPlatform;
  models: { id: string; name: string; providerName: string }[];
  currentModel: string;
  setCurrentModel: (id: string) => void;
}) {
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession } = useSession();
  const { status, abort, messages, send } = useChat();
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [view, setView] = useState<View>('chat');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === currentModel);
  const modelName = selectedModel?.name || currentModel;
  const modelProvider = selectedModel?.providerName || '';

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
  const modelSelector = (
    <div ref={dropRef} className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-[#222] hover:bg-[#333] text-gray-400 hover:text-gray-200 border border-[#333] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-gray-500">
          <circle cx="8" cy="8" r="3" />
        </svg>
        {modelProvider ? `${modelProvider} · ${modelName}` : modelName}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="text-gray-500">
          <path d="M3 5l3 3 3-3H3z" />
        </svg>
      </button>
      {dropdownOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1 overflow-hidden max-h-80 overflow-y-auto">
          {modelGroups.map(([provider, ms], gi) => (
            <div key={provider}>
              {gi > 0 && <div className="border-t border-[#2a2a2a] my-1" />}
              <div className="px-3 py-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                {provider}
              </div>
              {ms.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setCurrentModel(m.id); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
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

  // Navigation handler — desktop shows settings inline
  const handleNavigate = useCallback((v: View) => {
    setView(v);
  }, []);

  // Automation and Skills data
  const tools = useMemo(() => (config.toolRegistry?.listDefinitions() ?? []) as ToolDefinition[], [config.toolRegistry]);
  const agentSkills = useMemo(() => (config.capabilities?.skillManager?.list() ?? []) as SkillDefinition[], [config.capabilities]);

  return (
    <div className="flex h-screen bg-black text-gray-100 font-mono">
      <Sidebar
        config={config}
        platform={platform}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={() => { create(); setView('chat'); }}
        onSwitchSession={switchTo}
        onDeleteSession={deleteSession}
        onNavigate={handleNavigate}
        activeView={view}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {(view === 'chat' || view === 'search') && (
            <ChatContent modelSelector={modelSelector} slashCommands={slashCommands} matchedSkills={matchedSkills} onAbort={abort} />
          )}
          {view === 'automation' && (
            <AutomationPanel tools={tools} />
          )}
          {view === 'skills' && (
            <SkillsPanel skills={agentSkills} />
          )}
          {view === 'settings' && (
            <SettingsPanel platform={platform} agentConfig={config} onBack={() => setView('chat')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Automation panel ──────────────────────────────────────

function AutomationPanel({ tools }: { tools: ToolDefinition[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg text-white font-light mb-4">自动化工具</h2>
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

function SkillsPanel({ skills }: { skills: SkillDefinition[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg text-white font-light mb-4">技能</h2>
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
