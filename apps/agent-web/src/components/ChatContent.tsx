'use client';

import React, { useMemo, useRef } from 'react';
import {
  ChatPanel,
  ResponsiveArtifactHost,
  type ChatPanelMessage,
  type PresetItem,
  type SlashCommand,
  type MentionItem,
} from '@svton/agent-ui';
import { useChat, useToolApproval, useUserInput } from '@svton/agent-client';
import { prepareChatInput, projectClientMessageToChatPanel, useArtifactController, useChatInteractionController } from '@svton/agent-app';
import { ChatInputControls } from './ChatInputControls.component';
import { useWebTimelineIntents } from './use-web-timeline-intents';
import { createWebComposerFileAdapter } from './web-composer-file-adapter';
import { createWebArtifactHostAdapter } from './web-artifact-host-adapter';
import { useI18n } from '@svton/ui';
import {
  createWebArtifactPresentationCopy,
  createWebComposerFilePresentationCopy,
} from '@/lib/locale/web-presentation-copy';

const PRESET_PROMPTS = [
  '帮我写一个 React 组件，要求使用 TypeScript，支持 props 类型检查',
  '请解释这段代码的工作原理，逐行分析关键逻辑',
  '帮我分析和修复一个 Bug，我会描述具体的错误信息和复现步骤',
  '请帮我审查并优化代码的性能，找出潜在的性能瓶颈',
] as const;

interface ChatContentProps {
  modelSelector: React.ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  sessionSettings: React.ReactNode;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
}

export function ChatContent({
  modelSelector,
  slashCommands,
  matchedSkills,
  onAbort,
  mentionItems,
  onMentionSelect,
  sessionSettings,
  plugins,
  onPluginToggle,
}: ChatContentProps) {
  const { translate: t } = useI18n();
  const bootTranslator = useRef(t).current;
  const { messages, isStreaming, canSend, submitPrepared, retry, retryFromMessage, editMessage, activePlan, inputHistory } = useChat();
  const { request: approvalRequest, settle: settleApproval, approve, reject } = useToolApproval();
  const {
    request: userInputRequest,
    submit: submitUserInput,
    updateDraft: updateUserInputDraft,
  } = useUserInput();
  const timelineHosts = useWebTimelineIntents(retryFromMessage);
  const fileAdapter = useMemo(() => createWebComposerFileAdapter(
    createWebComposerFilePresentationCopy(bootTranslator),
  ), [bootTranslator]);
  const artifactHost = useMemo(() => createWebArtifactHostAdapter(
    createWebArtifactPresentationCopy(bootTranslator),
  ), [bootTranslator]);
  const artifact = useArtifactController(artifactHost);
  const interaction = useChatInteractionController({
    canSend, isStreaming, stop: onAbort, slashCommands, fileAdapter,
    send: (submission) => submitPrepared(prepareChatInput(submission)),
  });

  const presets: PresetItem[] = useMemo(() => [
    { label: t('web.composer.preset.react'), prompt: PRESET_PROMPTS[0] },
    { label: t('web.composer.preset.explain'), prompt: PRESET_PROMPTS[1] },
    { label: t('web.composer.preset.fix'), prompt: PRESET_PROMPTS[2] },
    { label: t('web.composer.preset.optimize'), prompt: PRESET_PROMPTS[3] },
  ], [t]);

  const panelMessages: ChatPanelMessage[] = useMemo(
    () =>
      messages.map((message) => projectClientMessageToChatPanel(message)),
    [messages],
  );

  const inputLeadingSlot = useMemo(() => (
    <ChatInputControls
      modelSelector={modelSelector}
      sessionSettings={sessionSettings}
      plugins={plugins}
      onPluginToggle={onPluginToggle}
    />
  ), [
    modelSelector,
    sessionSettings,
    plugins,
    onPluginToggle,
  ]);

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
            ? t('web.composer.busyOtherSession')
            : undefined}
          placeholder={t('web.composer.placeholder')}
          emptyMessage={(
            <div className="text-center py-8">
              <h2 className="text-2xl text-white font-light tracking-tight mb-2">
                {t('web.composer.emptyTitle')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('web.composer.emptyDescription')}
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
