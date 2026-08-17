import React from 'react';
import { useSession, type Project } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import { Sidebar } from './Sidebar';
import type { View } from './desktop-sidebar.types';

export function DesktopConversationSidebar({
  session, config, projects, currentProjectId, onNavigate,
  onSwitchProject, onOpenProjectFolder, onDeleteProject, activeView,
}: {
  session: ReturnType<typeof useSession>;
  config: AgentConfig | null;
  projects: Project[];
  currentProjectId: string | null;
  onNavigate: (view: View) => void;
  onSwitchProject: (id: string | null) => void;
  onOpenProjectFolder: () => void;
  onDeleteProject: (id: string) => void;
  activeView: View;
}) {
  return (
    <Sidebar
      config={config}
      activeSessions={session.sessions}
      searchResults={session.search.results}
      sessionSearch={session.search}
      activityBySessionId={session.activityBySessionId}
      managementBySessionId={session.managementBySessionId}
      managementActions={session.management}
      currentSessionId={session.currentSessionId}
      projects={projects}
      currentProjectId={currentProjectId}
      onNewChat={() => { void session.create(); onNavigate('chat'); }}
      onSwitchSession={session.switchTo}
      onNavigate={onNavigate}
      onSwitchProject={onSwitchProject}
      onOpenProjectFolder={onOpenProjectFolder}
      onDeleteProject={onDeleteProject}
      activeView={activeView}
    />
  );
}
