import {
  Sidebar,
  type SidebarConfig,
  type SidebarItem,
} from '@svton/agent-ui';
import { useSession } from '@svton/agent-client';
import type { View } from '../types';

interface AgentShellSidebarProps {
  title: string;
  items: SidebarItem[];
  config?: Partial<SidebarConfig>;
  storageNamespace: string;
  activeView: View;
  onNavigate: (view: View) => void;
}

export function AgentShellSidebar({
  title,
  items,
  config,
  storageNamespace,
  activeView,
  onNavigate,
}: AgentShellSidebarProps) {
  const {
    sessions,
    currentSessionId,
    create,
    switchTo,
    delete: deleteSession,
  } = useSession();

  return (
    <Sidebar
      config={{
        title,
        items,
        collapsible: config?.collapsible ?? true,
        showSettings: config?.showSettings ?? true,
        showNewChat: config?.showNewChat ?? true,
        showSessions: config?.showSessions ?? true,
        defaultCollapsed: config?.defaultCollapsed ?? false,
        width: config?.width,
        collapsedWidth: config?.collapsedWidth,
        collapseStorageKey: config?.collapseStorageKey
          ?? `${storageNamespace}:sidebarCollapsed`,
      }}
      activeView={activeView}
      onNavigate={(view) => {
        if (view === 'chat' || view === 'settings') onNavigate(view);
      }}
      sessions={sessions.map((session) => ({
        id: session.id,
        title: session.title || '新对话',
      }))}
      currentSessionId={currentSessionId}
      onNewChat={() => {
        create();
        onNavigate('chat');
      }}
      onSwitchSession={(id) => {
        switchTo(id);
        onNavigate('chat');
      }}
      onDeleteSession={deleteSession}
      onOpenSettings={() => onNavigate('settings')}
    />
  );
}
