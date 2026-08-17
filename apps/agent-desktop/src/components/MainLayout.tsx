import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { useAgentContext, useChat, useSession, type ModelKey, type ModelSwitchHost } from '@svton/agent-client';
import {
  ModelSelector,
  ResponsiveAgentFrame,
  SessionSettingsControls,
  type SlashCommand,
} from '@svton/agent-ui';
import {
  useAgentShellModelControl,
  useSessionSettingsControl,
  type LiveModelRegistry,
} from '@svton/agent-app';
import type { View } from '@/components/Sidebar';
import { DesktopConversationSidebar } from '@/components/DesktopConversationSidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ChatContent } from '@/components/ChatContent';
import { DesktopMainTitleBar } from '@/components/DesktopMainTitleBar';
import { DesktopMainContent } from '@/components/DesktopMainContent';
import { DesktopSkillsPanel, type DesktopSkillDefinition } from '@/components/DesktopSkillsPanel';
import { DesktopPluginsPanel } from '@/components/DesktopPluginsPanel';
import { useGitBranch } from '@/hooks/useGitBranch';
import { useDesktopProjectActions } from '@/hooks/use-desktop-project-actions';
import { useDesktopMentionItems } from '@/hooks/use-desktop-mention-items';
import type { AgentExtra } from '@/lib/agent-setup';
import {
  AutomationPanelExtra,
  WorktreePanelExtra,
  AgentsPanelExtra,
  IntegrationsPanelView,
  ChroniclePanelExtra,
} from '@/components/ExtraPanels';
import { useDesktopPermissionProfileHost } from '@/lib/desktop-permission-profile-host';

interface MainLayoutProps {
  config: AgentConfig;
  platform: TauriPlatform;
  registry: LiveModelRegistry;
  modelSwitchHost: ModelSwitchHost;
  initialModelKey: ModelKey;
  onReinit?: (workingDir?: string) => void;
  extra?: AgentExtra;
}

export function MainLayout({ config, platform, registry, modelSwitchHost, initialModelKey, onReinit, extra }: MainLayoutProps) {
  const session = useSession();
  const { sessions, currentSessionId, create, updateProjectId } = session;
  const { abort, messages, send, submitPrepared } = useChat();
  const { projectService } = useAgentContext();
  const [view, setView] = useState<View>('chat');
  const { modelSelection } = useAgentShellModelControl(registry, modelSwitchHost, initialModelKey);
  const permissionMode = config.capabilities?.permissionManager?.getMode() ?? 'default';
  const permissionHost = useDesktopPermissionProfileHost(platform, permissionMode);
  const sessionSettings = useSessionSettingsControl(registry, permissionHost);
  const submitCommand = useCallback((content: string) => submitPrepared({ publicContent: content, runtimeContent: content, historyContent: content }), [submitPrepared]);
  const projects = projectService.projects ?? [];
  const currentProjectId = projectService.currentProjectId ?? null;
  const currentSession = sessions.find((item) => item.id === currentSessionId);
  const currentProject = projects.find((item) => item.id === currentProjectId);
  const workingDir = currentProject?.path || config.workingDir || '/';
  const gitBranch = useGitBranch(platform, workingDir);
  const projectActions = useDesktopProjectActions({ platform, projectService, currentSessionId, messageCount: messages.length, updateProjectId, onReinit });
  const mentionItems = useDesktopMentionItems(config, platform);
  const skills = useMemo(() => (config.capabilities?.skillManager?.list() ?? []) as DesktopSkillDefinition[], [config.capabilities]);
  const matchedSkills = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.role === 'user')?.content.toLowerCase();
    if (!latest) return [];
    return skills.filter((skill) => skill.description?.toLowerCase().split(/\s+/).some((word) => word.length > 3 && latest.includes(word))).map((skill) => skill.name);
  }, [messages, skills]);
  const plugins = useMemo(() => (config.capabilities?.pluginManager?.list() ?? []).map((plugin) => ({ name: plugin.name, enabled: plugin.enabled })), [config.capabilities]);
  const togglePlugin = useCallback(async (name: string, enabled: boolean) => {
    const manager = config.capabilities?.pluginManager;
    if (enabled) await manager?.enable(name);
    else await manager?.disable(name);
  }, [config.capabilities]);
  const slashCommands: SlashCommand[] = useMemo(() => [
    { id: 'session.new', name: 'new', description: '创建新对话', execute: async () => { await create(); return true; } },
    { id: 'session.clear', name: 'clear', description: '清空当前对话', execute: async () => { await create(); return true; } },
    { id: 'agent.help', name: 'help', description: '显示帮助信息', execute: () => submitCommand('请帮我了解你可以做什么，有哪些能力和工具') },
    { id: 'agent.status', name: 'status', description: '查看当前状态和能力', execute: () => submitCommand(`当前 Agent 状态:\n- 模型: ${config.model}\n请简要介绍你的能力。`) },
    { id: 'agent.review', name: 'review', description: '审查代码变更', execute: () => submitCommand('请帮我审查当前的代码变更。先用 git diff 查看未提交的更改，再分析每个变更的质量、潜在风险和改进建议。') },
    { id: 'agent.select', name: 'agent', description: '切换 Agent 定义', execute: () => submitCommand('请列出当前可用的 Agent 定义，并说明各自的适用场景。') },
  ], [config.model, create, submitCommand]);
  useEffect(() => {
    extra?.automationManager?.setTriggerHandler(async (automation) => { send(automation.prompt); setView('chat'); });
  }, [extra?.automationManager, send]);
  const popout = useCallback(async () => {
    if (!currentSessionId) return;
    try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('popout_session', { sessionId: currentSessionId }); }
    catch (error) { console.error('Popout failed:', error); }
  }, [currentSessionId]);

  if (view === 'settings') return <SettingsPanel platform={platform} agentConfig={config} extra={extra} registry={registry} modelSelection={modelSelection} executionControl={sessionSettings.execution} reasoningControl={sessionSettings.reasoning} onBack={() => setView('chat')} onReinit={onReinit} />;
  const titleBar = <DesktopMainTitleBar sessionTitle={currentSession?.title || '新对话'} projectName={currentProject?.name ?? null} gitBranch={gitBranch || null} canPopout={Boolean(currentSessionId)} onPopout={popout} />;
  const chat = <ChatContent modelSelector={<ModelSelector control={modelSelection} />} slashCommands={slashCommands} matchedSkills={matchedSkills} onAbort={abort} sessionSettings={<SessionSettingsControls execution={sessionSettings.execution} reasoning={sessionSettings.reasoning} />} plugins={plugins} onPluginToggle={togglePlugin} gitBranch={gitBranch || null} projectName={currentProject?.name ?? null} projects={projects.map((project) => ({ id: project.id, name: project.name }))} currentProjectId={currentProjectId} onSelectProject={projectActions.switchProject} mentionItems={mentionItems} onMentionSelect={(item) => `@${item.label}`} workingDir={workingDir} />;
  return (
    <ResponsiveAgentFrame
      className="bg-[#212121] text-gray-100"
      sidebarTitle="Svton"
      navigationLabel="打开对话与项目导航"
      header={titleBar}
      compactHeader={<DesktopMainTitleBar compact sessionTitle={currentSession?.title || '新对话'} projectName={currentProject?.name ?? null} gitBranch={gitBranch || null} canPopout={Boolean(currentSessionId)} onPopout={popout} />}
      sidebar={<DesktopConversationSidebar session={session} config={config} projects={projects} currentProjectId={currentProjectId} onNavigate={setView} onSwitchProject={projectActions.switchProject} onOpenProjectFolder={projectActions.openProjectFolder} onDeleteProject={projectActions.deleteProject} activeView={view} />}
    >
      <DesktopMainContent
        view={view}
        chat={chat}
        automation={<AutomationPanelExtra automationManager={extra?.automationManager} onManage={() => setView('settings')} />}
        skills={<DesktopSkillsPanel skills={skills} platform={platform} onManage={() => setView('settings')} onReinit={onReinit} />}
        plugins={<DesktopPluginsPanel config={config} platform={platform} />}
        agents={<AgentsPanelExtra config={config} onManage={() => setView('settings')} onSwitchAgent={(name) => { send(`/agent ${name}`); setView('chat'); }} />}
        worktrees={<WorktreePanelExtra worktreeManager={extra?.worktreeManager ?? config.capabilities?.worktreeManager} workingDir={workingDir} onManage={() => setView('settings')} />}
        integrations={<IntegrationsPanelView integrationManager={extra?.integrationManager} onManage={() => setView('settings')} />}
        chronicle={<ChroniclePanelExtra chronicleManager={extra?.chronicleManager} onManage={() => setView('settings')} />}
      />
    </ResponsiveAgentFrame>
  );
}
