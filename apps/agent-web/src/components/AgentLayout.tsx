'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ModelSelector,
  ResponsiveAgentFrame,
  SessionSettingsControls,
  type MentionItem,
  type SlashCommand,
} from '@svton/agent-ui';
import { useChat, useSession, type ModelKey, type ModelSwitchHost } from '@svton/agent-client';
import {
  useAgentShellModelControl,
  useSessionSettingsControl,
  type LiveModelRegistry,
} from '@svton/agent-app';
import type { AgentConfig } from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { View } from './Sidebar';
import { WebSessionSidebar } from './WebSessionSidebar';
import { ChatContent } from './ChatContent';
import { WebSettingsPanel } from './WebSettingsPanel';
import { WebAgentContent } from './WebAgentContent';
import { createWebPermissionProfileHost } from '@/lib/web-permission-profile-host';
import { useI18n } from '@svton/ui';

interface AgentLayoutProps {
  config: AgentConfig;
  registry: LiveModelRegistry;
  modelSwitchHost: ModelSwitchHost;
  initialModelKey: ModelKey;
  browserPlatform: BrowserPlatform;
}

export function AgentLayout({
  config,
  registry,
  modelSwitchHost,
  initialModelKey,
  browserPlatform,
}: AgentLayoutProps) {
  const { translate: t } = useI18n();
  const session = useSession();
  const { create } = session;
  const { abort, messages, submitPrepared } = useChat();
  const [view, setView] = useState<View>('chat');
  const { modelSelection } = useAgentShellModelControl(registry, modelSwitchHost, initialModelKey);
  const permissionHost = useMemo(createWebPermissionProfileHost, []);
  const sessionSettings = useSessionSettingsControl(registry, permissionHost);
  const submitCommand = useCallback((content: string) => submitPrepared({
    publicContent: content, runtimeContent: content, historyContent: content,
  }), [submitPrepared]);

  const slashCommands: SlashCommand[] = useMemo(() => [
    { id: 'session.new', name: 'new', description: t('web.command.new.description'), execute: async () => { await create(); return true; } },
    { id: 'session.clear', name: 'clear', description: t('web.command.clear.description'), execute: async () => { await create(); return true; } },
    { id: 'agent.review', name: 'review', description: t('web.command.review.description'), execute: () => submitCommand('/review') },
    { id: 'agent.select', name: 'agent', description: t('web.command.agent.description'), capability: { supported: false, reason: t('web.command.agent.unavailable') } },
    { id: 'agent.help', name: 'help', description: t('web.command.help.description'), execute: () => submitCommand('请帮我了解你可以做什么，有哪些能力和工具') },
    { id: 'agent.status', name: 'status', description: t('web.command.status.description'), execute: () => submitCommand(`当前 Agent 状态:\n- 模型: ${config.model}\n请简要介绍你的能力。`) },
  ], [config.model, create, submitCommand, t]);

  const matchedSkills = useMemo(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) return [];
    const content = lastUserMessage.content.toLowerCase();
    return (config.capabilities?.skillManager?.list() ?? [])
      .filter((skill) => skill.description.toLowerCase().split(/\s+/).some((word) => word.length > 3 && content.includes(word)))
      .map((skill) => skill.name);
  }, [config.capabilities, messages]);

  const tools = useMemo(() => config.toolRegistry?.listDefinitions() ?? [], [config.toolRegistry]);
  const skills = useMemo(() => config.capabilities?.skillManager?.list() ?? [], [config.capabilities]);
  const mentionItems: MentionItem[] = useMemo(() => [
    ...skills.map((skill) => ({
      id: `skill:${skill.name}:${skill.source?.type === 'local' ? skill.source.path : skill.scope}`,
      label: skill.name,
      name: skill.name,
      path: skill.source?.type === 'local' ? skill.source.path : `skill:${skill.name}`,
      description: skill.description,
      category: 'skill' as const,
    })),
    ...tools.slice(0, 20).map((tool) => ({
      id: `tool:${tool.name}`,
      label: tool.name,
      name: tool.name,
      path: `tool:${tool.name}`,
      description: tool.description,
      category: 'tool' as const,
    })),
  ], [skills, tools]);
  const plugins = useMemo(() => (
    config.capabilities?.pluginManager?.list() ?? []
  ).map((plugin) => ({ name: plugin.name, enabled: plugin.enabled })), [config.capabilities]);
  const handlePluginToggle = useCallback(async (name: string, enabled: boolean) => {
    const manager = config.capabilities?.pluginManager;
    if (!manager) return;
    if (enabled) await manager.enable(name);
    else await manager.disable(name);
  }, [config.capabilities]);

  const chat = (
    <ChatContent
      modelSelector={<ModelSelector control={modelSelection} />}
      slashCommands={slashCommands}
      matchedSkills={matchedSkills}
      onAbort={abort}
      mentionItems={mentionItems}
      onMentionSelect={(item) => `@${item.label}`}
      sessionSettings={<SessionSettingsControls execution={sessionSettings.execution} reasoning={sessionSettings.reasoning} />}
      plugins={plugins}
      onPluginToggle={handlePluginToggle}
    />
  );
  const settings = (
    <WebSettingsPanel
      platform={browserPlatform}
      config={config}
      registry={registry}
      modelSelection={modelSelection}
      executionControl={sessionSettings.execution}
      reasoningControl={sessionSettings.reasoning}
      onBack={() => setView('chat')}
    />
  );
  if (view === 'settings') return settings;
  return (
    <ResponsiveAgentFrame
      className="bg-black font-mono text-gray-100"
      sidebarTitle="Svton"
      navigationLabel={t('web.navigation.open')}
      compactHeader={<span className="block truncate text-sm text-gray-300">{t(`web.nav.${view}`)}</span>}
      sidebar={<WebSessionSidebar session={session} view={view} onNavigate={setView} />}
    >
      <WebAgentContent view={view} config={config} chat={chat} settings={settings} tools={tools} skills={skills} />
    </ResponsiveAgentFrame>
  );
}
