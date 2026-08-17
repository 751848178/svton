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
    currentSessionId,
    create,
    switchTo,
    activityBySessionId,
    managementBySessionId,
    management,
    search,
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
      sessions={search.results.map((result) => ({
        id: result.session.id,
        title: result.session.title || '新对话',
        activity: activityBySessionId.get(result.session.id),
        management: managementBySessionId.get(result.session.id),
        snippet: result.snippet,
        snippetSource: result.source,
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
      managementActions={management}
      sessionSearch={search}
      onOpenSettings={() => onNavigate('settings')}
    />
  );
}
