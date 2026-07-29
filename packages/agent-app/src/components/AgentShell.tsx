/** Composes the sidebar, toolbar, settings, chat, and split-screen surfaces. */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@svton/ui';
import {
  ChatPanel,
  SplitScreenPanel,
  type ChatPanelMessage,
  type ISettingsAdapter,
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
import {
  readAgentShellPermissionMode,
  type AgentShellPermissionMode,
} from './agent-shell-permission.utils';
import { toInlineChatBlocks } from './agent-shell-message-boundary.utils';
import { AgentShellSettings } from './agent-shell-settings.component';
import { AgentShellSidebar } from './agent-shell-sidebar.component';
import { AgentShellToolbar } from './agent-shell-toolbar.component';

interface AgentShellProps {
  config: AgentConfig;
  models: ModelOption[];
  currentModel: string;
  onModelChange: (model: string) => void;
  adapter: ISettingsAdapter;
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
  const { create } = useSession();
  const { approve, reject } = useToolApproval();
  const [view, setView] = useState<View>('chat');
  const [permissionMode, setPermissionMode] = useState(
    () => readAgentShellPermissionMode(config)
  );
  const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffort>(undefined);
  const [splitScreen, setSplitScreen] = useState<SplitScreenContent | null>(null);

  // ── Permission mode ──
  const handlePermissionModeChange = useCallback((mode: AgentShellPermissionMode) => {
    setPermissionMode(mode);
    config.capabilities?.permissionManager?.setMode(mode);
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
  const matchedSkills = useMemo(() => {
    const skills = config.capabilities?.skillManager?.list() ?? [];
    if (!skills.length) return [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return [];
    const msg = lastUserMsg.content.toLowerCase();
    const matched = skills.filter(s => {
      const desc = s.description.toLowerCase();
      return desc.split(/\s+/).some((kw: string) => kw.length > 3 && msg.includes(kw));
    }).map(s => s.name);
    return matched.slice(0, 5);
  }, [messages, config]);

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
      toolCalls: msg.toolCalls,
      blocks: toInlineChatBlocks(msg.blocks),
      isStreaming: msg.isStreaming,
      duration: msg.duration,
      usage: i === messages.length - 1 && msg.role === 'assistant' && !msg.isStreaming && lastUsage ? {
        promptTokens: lastUsage.input,
        completionTokens: lastUsage.output,
        totalTokens: lastUsage.totalTokens,
      } : undefined,
    })),
  [messages, lastUsage]);

  // ── Settings view ──
  if (view === 'settings') {
    return (
      <AgentShellSettings
        title={title}
        adapter={adapter}
        onBack={() => setView('chat')}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#000000] text-gray-100 font-mono overflow-hidden">
      <AgentShellSidebar
        title={title}
        items={sidebarItems}
        config={sidebarConfig}
        storageNamespace={storageNamespace}
        activeView={view}
        onNavigate={setView}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AgentShellToolbar
          models={models}
          currentModel={currentModel}
          permissionMode={permissionMode}
          reasoningEffort={reasoningEffort}
          onModelChange={onModelChange}
          onPermissionModeChange={handlePermissionModeChange}
          onReasoningEffortChange={handleReasoningEffortChange}
        />

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
            <SplitScreenPanel content={splitScreen} onClose={() => setSplitScreen(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
