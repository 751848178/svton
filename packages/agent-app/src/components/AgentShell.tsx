/**
 * AgentShell — the complete application shell.
 *
 * SimpleSidebar (sessions + settings) + full ChatPanel from @svton/agent-ui.
 * This is the core of @svton/agent-app.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@svton/ui';
import {
  ChatPanel,
  SettingsView,
  Sidebar,
  type ChatPanelMessage,
  type SlashCommand,
  type MentionItem,
  type SplitScreenContent,
  type ReasoningEffort,
  type SidebarConfig,
  type SidebarItem,
} from '@svton/agent-ui';
import {
  useChat,
  useSession,
  useAgentContext,
  useToolApproval,
} from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import type { View, ModelOption } from '../types';
import { readAgentShellPermissionMode } from './agent-shell-permission.utils';

interface AgentShellProps {
  config: AgentConfig;
  models: ModelOption[];
  currentModel: string;
  onModelChange: (model: string) => void;
  adapter: any;
  title?: string;
  sidebarConfig?: Partial<SidebarConfig>;
  sidebarItems?: SidebarItem[];
  storageNamespace?: string;
}

export function AgentShell({
  config,
  models,
  currentModel,
  onModelChange,
  adapter,
  title = 'Svton Agent',
  sidebarConfig,
  sidebarItems = [],
  storageNamespace = 'svton-app',
}: AgentShellProps) {
  const { messages, isStreaming, lastUsage, send, retry, retryFromMessage, editMessage, abort, inputHistory } = useChat();
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession } = useSession();
  const { approve, reject } = useToolApproval();
  const [view, setView] = useState<View>('chat');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [permissionMode, setPermissionMode] = useState(
    () => readAgentShellPermissionMode(config)
  );
  const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffort>(undefined);
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [splitScreen, setSplitScreen] = useState<SplitScreenContent | null>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);

  // ── Permission mode ──
  const handlePermissionModeChange = useCallback((mode: string) => {
    setPermissionMode(mode as any);
    config.capabilities?.permissionManager?.setMode(mode as any);
    adapter.savePermissionMode?.(mode);
  }, [adapter, config]);
  useEffect(() => {
    setPermissionMode(readAgentShellPermissionMode(config));
  }, [config]);

  // ── Reasoning effort ──
  const { chatService } = useAgentContext();
  const handleReasoningEffortChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffortState(effort);
    chatService?.setReasoningEffort(effort);
  }, [chatService]);

  // ── Slash commands ──
  const slashCommands: SlashCommand[] = useMemo(() => [
    { name: 'new', description: '创建新对话', action: () => create() },
    { name: 'clear', description: '清空当前对话', action: () => create() },
    { name: 'review', description: '审查代码变更', action: () => { send('/review'); } },
    { name: 'help', description: '显示帮助', action: () => { send('请帮我了解你可以做什么'); } },
  ], [create, send]);

  // ── Skill matching ──
  useEffect(() => {
    const skills = config.capabilities?.skillManager?.list() ?? [];
    if (!skills.length) { setMatchedSkills([]); return; }
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) { setMatchedSkills([]); return; }
    const msg = lastUserMsg.content.toLowerCase();
    const matched = skills.filter(s => {
      const desc = s.description.toLowerCase();
      return desc.split(/\s+/).some((kw: string) => kw.length > 3 && msg.includes(kw));
    }).map(s => s.name);
    setMatchedSkills(matched.slice(0, 5));
  }, [messages.length, config]);

  // ── Mention items ──
  const mentionItems: MentionItem[] = useMemo(() => {
    const skills = (config.capabilities?.skillManager?.list() ?? []).slice(0, 10).map(s => ({
      category: 'skill' as const,
      label: s.name,
      description: s.description,
    }));
    return skills;
  }, [config]);

  // ── Panel messages ──
  const panelMessages: ChatPanelMessage[] = useMemo(() =>
    messages.map((msg, i) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking,
      error: msg.error,
      toolCalls: msg.toolCalls as any,
      blocks: msg.blocks as any,
      isStreaming: msg.isStreaming,
      duration: msg.duration,
      usage: i === messages.length - 1 && msg.role === 'assistant' && !msg.isStreaming && lastUsage ? {
        promptTokens: lastUsage.promptTokens,
        completionTokens: lastUsage.completionTokens,
        totalTokens: lastUsage.totalTokens,
      } : undefined,
    })),
  [messages, lastUsage]);

  // ── Model selector ──
  const modelSelector = (
    <ModelSelector
      models={models}
      currentModel={currentModel}
      onChange={onModelChange}
      open={dropdownOpen}
      setOpen={setDropdownOpen}
      dropRef={dropRef}
    />
  );

  // ── Settings view ──
  if (view === 'settings') {
    return (
      <div className="flex flex-col h-screen bg-[#000000] text-gray-100 font-mono">
        <SettingsHeader title={title} onBack={() => setView('chat')} />
        <div className="flex-1 overflow-hidden">
          <SettingsView adapter={adapter} onBack={() => setView('chat')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#000000] text-gray-100 font-mono overflow-hidden">
      {/* Sidebar — shared component */}
      <Sidebar
        config={{
          title,
          items: sidebarItems,
          collapsible: sidebarConfig?.collapsible ?? true,
          showSettings: sidebarConfig?.showSettings ?? true,
          showNewChat: sidebarConfig?.showNewChat ?? true,
          showSessions: sidebarConfig?.showSessions ?? true,
          defaultCollapsed: sidebarConfig?.defaultCollapsed ?? false,
          width: sidebarConfig?.width,
          collapsedWidth: sidebarConfig?.collapsedWidth,
          collapseStorageKey: sidebarConfig?.collapseStorageKey ?? `${storageNamespace}:sidebarCollapsed`,
        }}
        activeView={view}
        onNavigate={(v) => setView(v as View)}
        sessions={sessions.map(s => ({ id: s.id, title: s.title || '新对话' }))}
        currentSessionId={currentSessionId}
        onNewChat={() => { create(); setView('chat'); }}
        onSwitchSession={(id) => { switchTo(id); setView('chat'); }}
        onDeleteSession={deleteSession}
        onOpenSettings={() => setView('settings')}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
          {modelSelector}
          <div className="flex items-center gap-2">
            {/* Permission mode selector */}
            <select
              value={permissionMode}
              onChange={(e) => handlePermissionModeChange(e.target.value)}
              className="bg-[#1c1c1c] text-gray-400 text-[11px] rounded px-2 py-1 border border-[#2a2a2a] outline-none cursor-pointer hover:text-gray-200"
            >
              <option value="read_only">只读</option>
              <option value="plan">计划</option>
              <option value="default">默认</option>
              <option value="accept_edits">接受编辑</option>
              <option value="auto">全自动</option>
            </select>

            {/* Reasoning effort selector */}
            <select
              value={reasoningEffort ?? 'auto'}
              onChange={(e) => {
                const val = e.target.value;
                handleReasoningEffortChange(val === 'auto' ? undefined : val as ReasoningEffort);
              }}
              className="bg-[#1c1c1c] text-gray-400 text-[11px] rounded px-2 py-1 border border-[#2a2a2a] outline-none cursor-pointer hover:text-gray-200"
            >
              <option value="auto">Auto</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">Xhigh</option>
            </select>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex overflow-hidden">
          <div className={cn('min-h-0 flex flex-col', splitScreen ? 'w-1/2' : 'flex-1')}>
            <ChatPanel
              messages={panelMessages}
              isStreaming={isStreaming}
              slashCommands={slashCommands}
              matchedSkills={matchedSkills}
              onSend={send}
              onAbort={abort}
              onApproveTool={approve}
              onRejectTool={reject}
              onRetry={(id?: string) => id ? retryFromMessage(id) : retry()}
              onEditMessage={editMessage}
              onOpenDocument={(doc) => setSplitScreen(doc)}
              onOpenEditor={(content) => setSplitScreen({ type: 'document', title: 'Edit', content })}
              onMentionSelect={(item) => `@${item.label}`}
              mentionItems={mentionItems}
              inputHistory={inputHistory}
            />
          </div>

          {splitScreen && (
            <SplitScreenPanelLazy content={splitScreen} onClose={() => setSplitScreen(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lazy import SplitScreenPanel to avoid circular deps ──
import { SplitScreenPanel } from '@svton/agent-ui';
function SplitScreenPanelLazy({ content, onClose }: { content: SplitScreenContent; onClose: () => void }) {
  return <SplitScreenPanel content={content} onClose={onClose} />;
}

// ── Model Selector ──
function ModelSelector({
  models,
  currentModel,
  onChange,
  open,
  setOpen,
  dropRef,
}: {
  models: ModelOption[];
  currentModel: string;
  onChange: (model: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  dropRef: React.RefObject<HTMLDivElement | null>;
}) {
  const current = models.find(m => m.key === currentModel) ?? models.find(m => m.id === currentModel);
  const providers = [...new Set(models.map(m => m.providerName))];

  return (
    <div ref={dropRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[13px] text-gray-300 hover:text-white"
      >
        <span className="text-gray-500">{current?.providerName}</span>
        <span className="font-medium">{current?.name || currentModel}</span>
        <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><path d="M3 5l3 3 3-3H3z" /></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
          {providers.map(providerName => (
            <div key={providerName}>
              <div className="px-3 py-1 text-[10px] text-gray-600 uppercase">{providerName}</div>
              {models.filter(m => m.providerName === providerName).map(m => (
                <button
	                  key={m.key}
	                  onClick={() => { onChange(m.key); setOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#222] transition-colors',
	                    m.key === currentModel || m.id === currentModel ? 'text-cyan-400' : 'text-gray-400'
                  )}
                >
                  {m.name}
	                  {(m.key === currentModel || m.id === currentModel) && <span className="float-right">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Header ──
function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#222]">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-[12px]">
        ← 返回
      </button>
      <span className="text-sm text-gray-300">{title} — 设置</span>
    </div>
  );
}
