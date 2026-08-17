import React, { useMemo } from 'react';
import {
  ChatPanel,
  ResponsiveArtifactHost,
  type ChatPanelMessage,
} from '@svton/agent-ui';
import { useChat, useToolApproval, useUserInput } from '@svton/agent-client';
import { prepareChatInput, projectClientMessageToChatPanel, useArtifactController, useChatInteractionController } from '@svton/agent-app';
import { InputControls } from './InputControls';
import { CHAT_PRESETS } from './chat-content.constants';
import type { ChatContentProps } from './ChatContent.types';
import { useDesktopTimelineIntents } from './use-desktop-timeline-intents';
import { createDesktopComposerFileAdapter } from './desktop-composer-file-adapter';
import { createDesktopArtifactHostAdapter } from './desktop-artifact-host-adapter';

export function ChatContent({
  modelSelector,
  slashCommands,
  matchedSkills,
  onAbort,
  sessionSettings,
  plugins,
  onPluginToggle,
  gitBranch,
  projectName,
  projects,
  currentProjectId,
  onSelectProject,
  mentionItems,
  onMentionSelect,
  workingDir,
}: ChatContentProps) {
  const { messages, isStreaming, canSend, submitPrepared, retry, retryFromMessage, editMessage, activePlan, inputHistory } = useChat();
  const { request: approvalRequest, settle: settleApproval, approve, reject } = useToolApproval();
  const {
    request: userInputRequest,
    submit: submitUserInput,
    updateDraft: updateUserInputDraft,
  } = useUserInput();
  const timelineHosts = useDesktopTimelineIntents(retryFromMessage, workingDir);
  const fileAdapter = useMemo(createDesktopComposerFileAdapter, []);
  const artifactHost = useMemo(() => createDesktopArtifactHostAdapter(workingDir), [workingDir]);
  const artifact = useArtifactController(artifactHost);
  const interaction = useChatInteractionController({
    canSend, isStreaming, stop: onAbort, slashCommands, fileAdapter,
    send: (submission) => submitPrepared(prepareChatInput(submission)),
  });

  const presets = useMemo(() => CHAT_PRESETS, []);

  const panelMessages: ChatPanelMessage[] = useMemo(
    () =>
      messages.map((message) => projectClientMessageToChatPanel(message)),
    [messages],
  );

  // Whether project selector should be shown (only when no messages in conversation)
  const showProjectSelector = messages.length === 0 && projects && projects.length > 0;

  // Build the leading slot: model selector + controls, all in one row
  const inputLeadingSlot = useMemo(() => (
    <>
      {modelSelector}
      <InputControls
        sessionSettings={sessionSettings}
        plugins={plugins}
        onPluginToggle={onPluginToggle}
        gitBranch={gitBranch}
        projectName={projectName}
        projects={showProjectSelector ? projects : undefined}
        currentProjectId={currentProjectId}
        onSelectProject={onSelectProject}
      />
    </>
  ), [modelSelector, sessionSettings, plugins, onPluginToggle, gitBranch, projectName, showProjectSelector, projects, currentProjectId, onSelectProject]);

  return (
    <ResponsiveArtifactHost
      interaction={artifact}
      chat={(
        <ChatPanel
          messages={panelMessages}
          interaction={interaction}
          onAbort={onAbort}
          onApproveTool={approve}
          onRejectTool={reject}
          approvalRequest={approvalRequest}
          onApprovalDecision={settleApproval}
          userInputRequest={userInputRequest}
          onSubmitUserInput={submitUserInput}
          onUserInputDraftChange={updateUserInputDraft}
          onRetry={(messageId?: string) => messageId ? retryFromMessage(messageId) : retry()}
          onEditMessage={editMessage}
          artifactInteraction={artifact}
          onTimelineIntent={timelineHosts.onTimelineIntent}
          timelineCapabilities={timelineHosts.timelineCapabilities}
          isStreaming={isStreaming}
          disabled={!canSend && !isStreaming}
          disabledReason={!canSend && !isStreaming
            ? 'Another session is still running. Return to it or stop it before sending here.'
            : undefined}
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
          className="bg-transparent"
        />
      )}
    />
  );
}
