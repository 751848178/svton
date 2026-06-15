'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ChatPanel,
  SplitScreenPanel,
  type ChatPanelMessage,
  type PresetItem,
  type SlashCommand,
  type ToolCallInfo,
  type SplitScreenContent,
  type MentionItem,
  type ContentBlock,
  type ReasoningEffort,
} from '@svton/agent-ui';
import { useChat, useToolApproval } from '@svton/agent-client';

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
  permissionMode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';
  onPermissionModeChange: (mode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto') => void;
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
  const { messages, isStreaming, lastUsage, send, retry, retryFromMessage, editMessage, activePlan } = useChat();
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
      messages.map((msg, i) => {
        const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !msg.isStreaming;
        return {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          error: msg.error,
          toolCalls: msg.toolCalls as ToolCallInfo[] | undefined,
          blocks: msg.blocks as ContentBlock[] | undefined,
          isStreaming: msg.isStreaming,
          systemType: msg.systemType,
          duration: msg.duration,
          usage: isLastAssistant && lastUsage ? lastUsage : undefined,
        };
      }),
    [messages, lastUsage],
  );

  const handleSend = useCallback(
    (content: string, images?: Array<{ data: string; mimeType?: string }>) => send(content, images),
    [send],
  );

  // ── Inline input controls (permission mode + plan mode + plugins) ──
  const [permDropOpen, setPermDropOpen] = useState(false);
  const permDropRef = useRef<HTMLDivElement>(null);

  const permModes = [
    { id: 'read_only' as const, label: '只读', desc: '只读，不执行任何操作' },
    { id: 'plan' as const, label: '计划', desc: '只做计划，不执行' },
    { id: 'default' as const, label: '默认', desc: '需要确认才执行' },
    { id: 'accept_edits' as const, label: '接受编辑', desc: '自动接受文件编辑' },
    { id: 'auto' as const, label: '全自动', desc: '自动执行所有操作' },
  ];

  const currentPerm = permModes.find((m) => m.id === permissionMode) ?? permModes[2];

  const inputLeadingSlot = useMemo(() => (
    <>
      {modelSelector}
      {/* Permission mode */}
      <div ref={permDropRef} className="relative flex-shrink-0">
        <button
          onClick={() => setPermDropOpen(!permDropOpen)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border transition-colors ${
            planMode
              ? 'bg-amber-900/30 border-amber-700/50 text-amber-400'
              : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-200 hover:bg-[#333]'
          }`}
        >
          {planMode ? '⚡ Plan' : currentPerm.label}
          <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor" className="text-gray-500">
            <path d="M3 5l3 3 3-3H3z" />
          </svg>
        </button>
        {permDropOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
            {permModes.map((m) => (
              <button
                key={m.id}
                onClick={() => { onPermissionModeChange(m.id); setPermDropOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                  m.id === permissionMode
                    ? 'text-white bg-[#2a2a2a]'
                    : 'text-gray-400 hover:bg-[#2a2a2a]/60 hover:text-gray-200'
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-[10px] text-gray-500">{m.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Plugin toggles */}
      {plugins.length > 0 && (
        <PluginToggles plugins={plugins} onToggle={onPluginToggle} />
      )}
    </>
  ), [modelSelector, permissionMode, onPermissionModeChange, planMode, permDropOpen, currentPerm, plugins, onPluginToggle]);

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

// ── Plugin toggles ──────────────────────────────────────────

function PluginToggles({
  plugins,
  onToggle,
}: {
  plugins: Array<{ name: string; enabled: boolean }>;
  onToggle: (name: string, enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-[#222] hover:bg-[#333] text-gray-400 hover:text-gray-200 border border-[#333] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v2h1a2 2 0 0 1 0 4h-1v2a2 2 0 0 1-2 2h-2v-1a2 2 0 0 0-4 0v1H4a2 2 0 0 1-2-2v-2H1a2 2 0 0 1 0-4h1V6a2 2 0 0 1 2-2h2V3a2 2 0 0 1 2-2z" />
        </svg>
        插件
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-44 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
          {plugins.map((p) => (
            <label key={p.name} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-[#2a2a2a]/60 cursor-pointer">
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => onToggle(p.name, e.target.checked)}
                className="rounded"
              />
              <span className={p.enabled ? 'text-gray-200' : 'text-gray-500'}>{p.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
