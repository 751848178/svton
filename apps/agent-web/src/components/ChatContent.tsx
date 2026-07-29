'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ChatPanel,
  SplitScreenPanel,
  type ChatPanelMessage,
  type PresetItem,
  type SlashCommand,
  type SplitScreenContent,
  type MentionItem,
  type ReasoningEffort,
} from '@svton/agent-ui';
import { useChat, useToolApproval } from '@svton/agent-client';
import { projectClientMessageToChatPanel } from '@svton/agent-app';
import {
  ChatInputControls,
  type PermissionMode,
} from './ChatInputControls.component';

const PRESETS: PresetItem[] = [
  { label: '帮我写一个 React 组件', prompt: '帮我写一个 React 组件，要求使用 TypeScript，支持 props 类型检查' },
  { label: '解释这段代码的工作原理', prompt: '请解释这段代码的工作原理，逐行分析关键逻辑' },
  { label: '帮我修复这个 Bug', prompt: '帮我分析和修复一个 Bug，我会描述具体的错误信息和复现步骤' },
  { label: '优化代码性能', prompt: '请帮我审查并优化代码的性能，找出潜在的性能瓶颈' },
];

interface ChatContentProps {
  modelSelector: React.ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  planMode: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
}

export function ChatContent({
  modelSelector,
  slashCommands,
  matchedSkills,
  onAbort,
  mentionItems,
  onMentionSelect,
  permissionMode,
  onPermissionModeChange,
  planMode,
  onPlanModeChange,
  plugins,
  onPluginToggle,
  reasoningEffort,
  onReasoningEffortChange,
}: ChatContentProps) {
  const { messages, isStreaming, lastUsage, send, retry, retryFromMessage, editMessage, activePlan, inputHistory } = useChat();
  const { approve, reject } = useToolApproval();
  const [splitScreen, setSplitScreen] = useState<SplitScreenContent | null>(null);

  const handleOpenEditor = useCallback((content: string) => {
    setSplitScreen({ type: 'document', title: 'Edit', content });
  }, []);

  const handleOpenDocument = useCallback((doc: SplitScreenContent) => {
    setSplitScreen(doc);
  }, []);

  const presets: PresetItem[] = useMemo(() => PRESETS, []);

  const panelMessages: ChatPanelMessage[] = useMemo(
    () =>
      messages.map((message, index) => projectClientMessageToChatPanel(
        message,
        index === messages.length - 1
          && message.role === 'assistant'
          && !message.isStreaming
          ? lastUsage ?? undefined
          : undefined,
      )),
    [messages, lastUsage],
  );

  const handleSend = useCallback(
    (content: string, images?: Array<{ data: string; mimeType?: string }>) => send(content, images),
    [send],
  );

  const inputLeadingSlot = useMemo(() => (
    <ChatInputControls
      modelSelector={modelSelector}
      permissionMode={permissionMode}
      onPermissionModeChange={onPermissionModeChange}
      planMode={planMode}
      plugins={plugins}
      onPluginToggle={onPluginToggle}
    />
  ), [
    modelSelector,
    permissionMode,
    onPermissionModeChange,
    planMode,
    plugins,
    onPluginToggle,
  ]);

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <div className={splitScreen ? 'w-1/2 min-w-0 min-h-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
        <ChatPanel
          messages={panelMessages}
          onSend={handleSend}
          onAbort={onAbort}
          onApproveTool={approve}
          onRejectTool={reject}
          onRetry={(messageId?: string) => messageId ? retryFromMessage(messageId) : retry()}
          onEditMessage={editMessage}
          onOpenEditor={handleOpenEditor}
          onOpenDocument={handleOpenDocument}
          onOpenReference={(path) => {
            // Web: open file path in new tab if it's a URL, otherwise copy to clipboard
            if (path.startsWith('http')) {
              window.open(path, '_blank');
            } else {
              navigator.clipboard.writeText(path).catch(() => {});
            }
          }}
          onCommand={(action) => {
            console.log('Command action:', action);
          }}
          isStreaming={isStreaming}
          placeholder="描述你想做的事情...  输入 / 查看命令  @ 引用"
          emptyMessage={(
            <div className="text-center py-8">
              <h2 className="text-2xl text-white font-light tracking-tight mb-2">
                开始与 AI Agent 对话
              </h2>
              <p className="text-sm text-gray-500">
                输入指令，AI 将帮你搜索、分析、生成内容
              </p>
            </div>
          )}
          presets={presets}
          inputLeadingSlot={inputLeadingSlot}
          slashCommands={slashCommands}
          mentionItems={mentionItems}
          onMentionSelect={onMentionSelect}
          inputHistory={inputHistory}
          matchedSkills={matchedSkills}
          activePlan={activePlan}
          onFileReference={async () => {
            // Web: read a text file via hidden <input type="file"> and send its content
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'text/*,.ts,.tsx,.js,.jsx,.json,.md,.py,.go,.rs,.java,.c,.cpp,.h,.yml,.yaml,.toml,.ini,.env,.sh';
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const content = await file.text();
                const text = `📄 ${file.name}\n\`\`\`\n${content}\n\`\`\``;
                send(text);
              } catch (e) {
                console.error('Failed to read file:', e);
              }
            };
            input.click();
          }}
          className="bg-transparent"
        />
      </div>
      {splitScreen && (
        <div className="w-1/2 min-w-0">
          <SplitScreenPanel content={splitScreen} onClose={() => setSplitScreen(null)} />
        </div>
      )}
    </div>
  );
}
