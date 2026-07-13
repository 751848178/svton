import React, { useCallback, useMemo, useState } from 'react';
import {
  ChatPanel,
  SplitScreenPanel,
  type ChatPanelMessage,
  type ToolCallInfo,
  type SplitScreenContent,
} from '@svton/agent-ui';
import { useChat, useToolApproval } from '@svton/agent-client';
import { InputControls } from './InputControls';
import { buildOpenReferenceCommand } from '@/lib/reference-open.utils';
import { CHAT_PRESETS } from './chat-content.constants';
import type { ChatContentProps } from './ChatContent.types';

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
  workingDir,
}: ChatContentProps) {
  const { messages, isStreaming, lastUsage, send, retry, retryFromMessage, editMessage, activePlan, inputHistory } = useChat();
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

  const presets = useMemo(() => CHAT_PRESETS, []);

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
          activeSkills: msg.activeSkills,
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
              await invoke('process_exec', {
                command: buildOpenReferenceCommand(path, workingDir),
                cwd: null,
              });
            } catch (e) {
              console.error('Failed to open file:', e);
            }
          }}
          onCommand={async (action) => {
            // Execute slash-command actions (e.g. run-tests, deploy).
            // The action string is a semantic command id; send it as a prompt
            // so the agent can act on it.
            if (action && typeof action === 'string') {
              send(action);
            }
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
          inputHistory={inputHistory}
          matchedSkills={matchedSkills}
          activePlan={activePlan}
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
