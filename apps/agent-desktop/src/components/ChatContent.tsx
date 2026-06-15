import React, { useCallback, useMemo, useState } from 'react';
import {
  ChatPanel,
  SplitScreenPanel,
  type ChatPanelMessage,
  type PresetItem,
  type ToolCallInfo,
  type SplitScreenContent,
  type SlashCommand,
  type MentionItem,
  type ReasoningEffort,
} from '@svton/agent-ui';
import { useChat, useToolApproval } from '@svton/agent-client';
import { InputControls } from './InputControls';

const PRESETS: PresetItem[] = [
  { label: '帮我写一个 React 组件', prompt: '帮我写一个 React 组件，要求使用 TypeScript，支持 props 类型检查' },
  { label: '解释这段代码的工作原理', prompt: '请解释这段代码的工作原理，逐行分析关键逻辑' },
  { label: '帮我修复这个 Bug', prompt: '帮我分析和修复一个 Bug，我会描述具体的错误信息和复现步骤' },
  { label: '优化代码性能', prompt: '请帮我审查并优化代码的性能，找出潜在的性能瓶颈' },
];

interface ProjectInfo {
  id: string;
  name: string;
}

export function ChatContent({
  modelSelector,
  slashCommands,
  matchedSkills,
  onAbort,
  permissionMode,
  onPermissionModeChange,
  planMode,
  onPlanModeChange,
  plugins,
  onPluginToggle,
  gitBranch,
  projectName,
  projects,
  currentProjectId,
  onSelectProject,
  mentionItems,
  onMentionSelect,
  reasoningEffort,
  onReasoningEffortChange,
}: {
  modelSelector: React.ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
  permissionMode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';
  onPermissionModeChange: (mode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto') => void;
  planMode: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
  gitBranch?: string | null;
  projectName?: string | null;
  projects?: ProjectInfo[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
}) {
  const { messages, isStreaming, lastUsage, send, retry, retryFromMessage, editMessage } = useChat();
  const { approve, reject } = useToolApproval();
  const [splitScreen, setSplitScreen] = useState<SplitScreenContent | null>(null);
  /** Preview content stored for popout windows to read */
  const [popoutContent, setPopoutContent] = useState<SplitScreenContent | null>(null);

  const handleOpenDocument = useCallback(async (doc: SplitScreenContent) => {
    const previewMode = localStorage.getItem('agent:preview_mode') || 'sidebar';

    if (previewMode === 'window') {
      try {
        const key = Date.now().toString();

        // Store content in localStorage BEFORE opening the window.
        // localStorage is shared across all Tauri webviews with the same origin,
        // so the preview window can read it immediately on mount.
        localStorage.setItem(`svton-preview-${key}`, JSON.stringify(doc));

        // Open the preview window — the URL includes the key so it can find the content
        const { invoke } = await import('@tauri-apps/api/core' as string);
        await invoke('popout_preview', { key });
      } catch (e) {
        console.error('Popout preview failed:', e);
        // Fallback to sidebar mode
        setSplitScreen(doc);
      }
    } else {
      setSplitScreen(doc);
    }
  }, []);

  const handleOpenEditor = useCallback((content: string) => { setSplitScreen({ type: 'document', title: 'Edit', content }); }, []);

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
          blocks: msg.blocks as import('@svton/agent-ui').ContentBlock[] | undefined,
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

  // Whether project selector should be shown (only when no messages in conversation)
  const showProjectSelector = messages.length === 0 && projects && projects.length > 0;

  // Build the leading slot: model selector + controls, all in one row
  const inputLeadingSlot = useMemo(() => (
    <>
      {modelSelector}
      <InputControls
        permissionMode={permissionMode}
        onPermissionModeChange={onPermissionModeChange}
        planMode={planMode}
        onPlanModeChange={onPlanModeChange}
        plugins={plugins}
        onPluginToggle={onPluginToggle}
        gitBranch={gitBranch}
        projectName={projectName}
        projects={showProjectSelector ? projects : undefined}
        currentProjectId={currentProjectId}
        onSelectProject={onSelectProject}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={onReasoningEffortChange}
      />
    </>
  ), [modelSelector, permissionMode, onPermissionModeChange, planMode, onPlanModeChange, plugins, onPluginToggle, gitBranch, projectName, showProjectSelector, projects, currentProjectId, onSelectProject, reasoningEffort, onReasoningEffortChange]);

  return (
    <div className="flex flex-1 min-w-0 min-h-0 relative">
      <div className={splitScreen ? 'w-1/2 min-w-0 min-h-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
        <ChatPanel
          messages={panelMessages}
          onSend={handleSend}
          onAbort={onAbort}
          onApproveTool={approve}
          onRejectTool={reject}
          onRetry={(messageId?: string) => messageId ? retryFromMessage(messageId) : retry()}
          onEditMessage={editMessage}
          onOpenDocument={handleOpenDocument}
          onOpenEditor={handleOpenEditor}
          onOpenReference={async (path, _line) => {
            try {
              const api = await import('@tauri-apps/api/core' as string);
              const invoke = (api as any).invoke;
              // Resolve relative path against working directory
              const workingDir = (window as any).__svtonWorkingDir || '';
              const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `${workingDir}/${path}`;
              await invoke('process_exec', { command: ['open', fullPath], cwd: null });
            } catch (e) {
              console.error('Failed to open file:', e);
            }
          }}
          onCommand={async (action) => {
            // Command actions can be extended; for now, log and handle common ones
            console.log('Command action:', action);
          }}
          isStreaming={isStreaming}
          placeholder="描述你想做的事情...  输入 / 查看命令  @ 引用"
          emptyMessage={(
            <div className="text-center py-8">
              <h2 className="text-2xl text-white font-light tracking-tight mb-2">
                开始与 AI Agent 对话
              </h2>
              <p className="text-sm text-gray-500 mb-6">
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
          onFileReference={async () => {
            try {
              const api = await import('@tauri-apps/api/core' as string);
              const invoke = (api as any).invoke;
              const filePath = await invoke('dialog_open_file') as string | null;
              if (!filePath) return;
              const content = await invoke('fs_read_file', { path: filePath }) as string;
              const name = filePath.replace(/\\/g, '/').split('/').pop() || 'file';
              const text = `📄 ${name}\n\`\`\`\n${content}\n\`\`\``;
              send(text);
            } catch { /* cancelled or error */ }
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
