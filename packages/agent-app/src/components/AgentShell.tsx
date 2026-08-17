import { useState, useCallback, useMemo } from 'react';
import {
  ChatPanel,
  ResponsiveAgentFrame,
  ResponsiveArtifactHost,
  type ChatPanelMessage,
  type ISettingsAdapter,
  type SlashCommand,
  type MentionItem,
  type SidebarConfig,
  type SidebarItem,
} from '@svton/agent-ui';
import {
  useChat,
  useSession,
  useToolApproval,
  useUserInput,
  type ModelKey,
  type ModelSwitchHost,
} from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import type { View } from '../types';
import type { LiveModelRegistry } from '../models/model-registry';
import { projectClientMessageToChatPanel } from './agent-shell-message-boundary.utils';
import { AgentShellSettings } from './agent-shell-settings.component';
import { AgentShellSidebar } from './agent-shell-sidebar.component';
import { AgentShellToolbar } from './agent-shell-toolbar.component';
import { useAgentShellTimelineIntents } from './use-agent-shell-timeline-intents';
import { useChatInteractionController } from '../chat/use-chat-interaction-controller';
import { prepareChatInput } from '../chat/composer-submission';
import { useArtifactController } from '../artifacts/use-artifact-controller';
import { useAgentShellModelControl } from './use-agent-shell-model-control';
import { useSessionSettingsControl } from '../models/use-session-settings-control';
import { createAgentAppPermissionProfileHost } from '../models/agent-app-permission-profile-host';
interface AgentShellProps {
  config: AgentConfig;
  modelRegistry: LiveModelRegistry;
  modelSwitchHost: ModelSwitchHost;
  initialModelKey: ModelKey;
  adapter: ISettingsAdapter;
  title?: string;
  sidebarConfig?: Partial<SidebarConfig>;
  sidebarItems?: SidebarItem[];
  storageNamespace?: string;
}
export function AgentShell({
  config,
  modelRegistry,
  modelSwitchHost,
  initialModelKey,
  adapter,
  title = 'Svton Agent',
  sidebarConfig,
  sidebarItems = [],
  storageNamespace = 'svton-app',
}: AgentShellProps) {
  const { messages, isStreaming, canSend, submitPrepared, retry, retryFromMessage, editMessage, abort, inputHistory } = useChat();
  const { create } = useSession();
  const { request: approvalRequest, settle: settleApproval, approve, reject } = useToolApproval();
  const {
    request: userInputRequest,
    submit: submitUserInput,
    updateDraft: updateUserInputDraft,
  } = useUserInput();
  const [view, setView] = useState<View>('chat');
  const { modelSelection } =
    useAgentShellModelControl(modelRegistry, modelSwitchHost, initialModelKey);
  const permissionHost = useMemo(
    () => createAgentAppPermissionProfileHost(adapter), [adapter],
  );
  const sessionSettings = useSessionSettingsControl(modelRegistry, permissionHost);
  const artifact = useArtifactController();
  const timelineIntents = useAgentShellTimelineIntents(retryFromMessage);
  const submitCommand = useCallback((content: string) => submitPrepared({
    publicContent: content, runtimeContent: content, historyContent: content,
  }), [submitPrepared]);

  const slashCommands: SlashCommand[] = useMemo(() => [
    { id: 'session.new', name: 'new', description: '创建新对话', execute: async () => { await create(); return true; } },
    { id: 'session.clear', name: 'clear', description: '清空当前对话', execute: async () => { await create(); return true; } },
    { id: 'agent.review', name: 'review', description: '审查代码变更', execute: () => submitCommand('/review') },
    { id: 'agent.help', name: 'help', description: '显示帮助', execute: () => submitCommand('请帮我了解你可以做什么') },
  ], [create, submitCommand]);
  const interaction = useChatInteractionController({
    canSend, isStreaming, stop: abort, slashCommands,
    send: (submission) => submitPrepared(prepareChatInput(submission)),
  });

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

  const mentionItems: MentionItem[] = useMemo(() => {
    const skills = (config.capabilities?.skillManager?.list() ?? []).slice(0, 10).map(s => ({
      id: `skill:${s.name}:${s.source?.type === 'local' ? s.source.path : s.scope}`,
      category: 'skill' as const,
      label: s.name,
      name: s.name,
      path: s.source?.type === 'local' ? s.source.path : `skill:${s.name}`,
      description: s.description,
    }));
    return skills;
  }, [config]);

  const panelMessages: ChatPanelMessage[] = useMemo(
    () => messages.map((message) => projectClientMessageToChatPanel(message)), [messages]);

  if (view === 'settings') {
    return (
      <AgentShellSettings
        title={title}
        adapter={adapter}
        modelSelection={modelSelection}
        execution={sessionSettings.execution}
        reasoning={sessionSettings.reasoning}
        onBack={() => setView('chat')}
      />
    );
  }

  return (
    <ResponsiveAgentFrame
      className="bg-[#000000] font-mono text-gray-100"
      sidebarTitle={title}
      navigationLabel="打开对话导航"
      sidebar={<AgentShellSidebar
        title={title}
        items={sidebarItems}
        config={sidebarConfig}
        storageNamespace={storageNamespace}
        activeView={view}
        onNavigate={setView}
      />}
      header={<AgentShellToolbar
        modelSelection={modelSelection}
        execution={sessionSettings.execution}
        reasoning={sessionSettings.reasoning}
      />}
      compactHeader={<AgentShellToolbar
        compact
        modelSelection={modelSelection}
        execution={sessionSettings.execution}
        reasoning={sessionSettings.reasoning}
      />}
    >
        <ResponsiveArtifactHost
          interaction={artifact}
          chat={(
            <ChatPanel
              messages={panelMessages}
              interaction={interaction}
              isStreaming={isStreaming}
              disabled={!canSend && !isStreaming}
              disabledReason={!canSend && !isStreaming
                ? 'Another session is still running. Return to it or stop it before sending here.'
                : undefined}
              slashCommands={slashCommands}
              matchedSkills={matchedSkills}
              onAbort={abort}
              onApproveTool={approve}
              onRejectTool={reject}
              approvalRequest={approvalRequest}
              onApprovalDecision={settleApproval}
              userInputRequest={userInputRequest}
              onSubmitUserInput={submitUserInput}
              onUserInputDraftChange={updateUserInputDraft}
              onRetry={(id?: string) => id ? retryFromMessage(id) : retry()}
              onEditMessage={editMessage}
              artifactInteraction={artifact}
              {...timelineIntents}
              onMentionSelect={(item) => `@${item.label}`}
              mentionItems={mentionItems}
              inputHistory={inputHistory}
            />
          )}
        />
    </ResponsiveAgentFrame>
  );
}
