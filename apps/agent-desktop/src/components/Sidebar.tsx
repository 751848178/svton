import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@svton/ui';
import type { SessionInfo } from '@svton/agent-client';
import {
  DesktopSidebarNavigation,
  DesktopSidebarSettings,
} from './DesktopSidebarNavigation';
import { DesktopSessionGroups } from './DesktopSessionGroups';
import { DesktopSessionSearch } from './DesktopSessionSearch';
import type { DesktopSidebarProps } from './desktop-sidebar.types';

export type { View } from './desktop-sidebar.types';

/** Desktop sidebar composition; row activity mapping is shared with every host. */
export function Sidebar({
  activityBySessionId,
  managementBySessionId,
  managementActions,
  sessionSearch,
  searchResults,
  activeSessions,
  currentSessionId,
  projects,
  currentProjectId,
  onNewChat,
  onSwitchSession,
  onNavigate,
  onSwitchProject,
  onOpenProjectFolder,
  onDeleteProject,
  activeView,
  className,
}: DesktopSidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const groupedSessions = useMemo(
    () => groupSessions(activeSessions, projects.map((project) => project.id)),
    [activeSessions, projects],
  );
  const selectSearchResult = useCallback((id: string) => {
    onSwitchSession(id);
    onNavigate('chat');
    setSearchOpen(false);
  }, [onSwitchSession, onNavigate]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        const topLayer = Array.from(
          document.querySelectorAll<HTMLElement>('[data-svton-modal-layer]'),
        ).at(-1);
        if (topLayer && !topLayer.querySelector('[data-desktop-session-search]')) return;
        event.preventDefault();
        setSearchOpen((open) => {
          if (open) window.requestAnimationFrame(focusSearchQuery);
          return true;
        });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className={cn(
      'flex h-full min-h-0 w-60 shrink-0 select-none flex-col border-r border-[#333] bg-[#1e1e1e]/95',
      className,
    )}>
      <DesktopSidebarNavigation
        activeView={activeView}
        onNewChat={onNewChat}
        onSearch={() => setSearchOpen(true)}
        onNavigate={onNavigate}
      />
      <DesktopSessionGroups
        projects={projects}
        groupedSessions={groupedSessions}
        activityBySessionId={activityBySessionId}
        managementBySessionId={managementBySessionId}
        managementActions={managementActions}
        currentSessionId={currentSessionId}
        currentProjectId={currentProjectId}
        activeView={activeView}
        onSwitchSession={onSwitchSession}
        onNavigate={onNavigate}
        onSwitchProject={onSwitchProject}
        onOpenProjectFolder={onOpenProjectFolder}
        onDeleteProject={onDeleteProject}
      />
      <DesktopSidebarSettings
        active={activeView === 'settings'}
        onClick={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')}
      />
      <DesktopSessionSearch
        open={searchOpen}
        results={searchResults}
        activityBySessionId={activityBySessionId}
        managementBySessionId={managementBySessionId}
        managementActions={managementActions}
        search={sessionSearch}
        onSelect={selectSearchResult}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}

function focusSearchQuery(): void {
  const query = document.querySelector<HTMLInputElement>(
    '[data-desktop-session-search-query]',
  );
  query?.focus();
  query?.select();
}

function groupSessions(
  sessions: SessionInfo[],
  projectIds: string[],
): ReadonlyMap<string, SessionInfo[]> {
  const groups = new Map<string, SessionInfo[]>([
    ...projectIds.map((id) => [id, []] as [string, SessionInfo[]]),
    ['__chat__', []],
  ]);
  for (const session of sessions) {
    const key = session.projectId || '__chat__';
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  return groups;
}
