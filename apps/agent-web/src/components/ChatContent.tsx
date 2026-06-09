'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ChatPanel, SplitScreenPanel, type ChatPanelMessage, type PresetItem, type SlashCommand, type ToolCallInfo, type SplitScreenContent } from '@svton/agent-ui';
import { useChat, useToolApproval } from '@svton/agent-client';

interface ChatContentProps {
  modelSelector: React.ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
}

export function ChatContent({ modelSelector, slashCommands, matchedSkills, onAbort }: ChatContentProps) {
  const { messages, isStreaming, lastUsage, send, retry, editMessage } = useChat();
  const { approve, reject } = useToolApproval();
  const [splitScreen, setSplitScreen] = useState<SplitScreenContent | null>(null);

  const handleOpenEditor = useCallback((content: string) => {
    setSplitScreen({ type: 'document', title: 'Edit', content });
  }, []);

  const handleOpenDocument = useCallback((doc: SplitScreenContent) => {
    setSplitScreen(doc);
  }, []);

  const presets: PresetItem[] = useMemo(() => [
    { label: '帮我写一个 React 组件', prompt: '帮我写一个 React 组件，要求使用 TypeScript，支持 props 类型检查' },
    { label: '解释这段代码的工作原理', prompt: '请解释这段代码的工作原理，逐行分析关键逻辑' },
    { label: '帮我修复这个 Bug', prompt: '帮我分析和修复一个 Bug，我会描述具体的错误信息和复现步骤' },
    { label: '优化代码性能', prompt: '请帮我审查并优化代码的性能，找出潜在的性能瓶颈' },
  ], []);

  const panelMessages: ChatPanelMessage[] = useMemo(
    () =>
      messages.map((msg, i) => {
        const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !msg.isStreaming;
        return {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          error: msg.error,
          toolCalls: msg.toolCalls as ToolCallInfo[] | undefined,
          isStreaming: msg.isStreaming,
          systemType: msg.systemType,
          usage: isLastAssistant && lastUsage ? lastUsage : undefined,
        };
      }),
    [messages, lastUsage],
  );

  const handleSend = useCallback((content: string, images?: Array<{ data: string; mimeType?: string }>) => send(content, images), [send]);

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <div className={splitScreen ? 'w-1/2 min-w-0 flex flex-col' : 'flex-1 flex flex-col'}>
        <ChatPanel
          messages={panelMessages}
          onSend={handleSend}
          onAbort={onAbort}
          onApproveTool={approve}
          onRejectTool={reject}
          onRetry={retry}
          onEditMessage={editMessage}
          onOpenEditor={handleOpenEditor}
          onOpenDocument={handleOpenDocument}
          isStreaming={isStreaming}
          placeholder="描述你想做的事情...  输入 / 查看命令"
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
          inputLeadingSlot={modelSelector as React.ReactNode}
          slashCommands={slashCommands}
          matchedSkills={matchedSkills}
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
