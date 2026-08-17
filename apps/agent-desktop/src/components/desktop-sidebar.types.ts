import type { AgentConfig } from '@svton/agent-core';
import type {
  Project,
  SessionActivityViewModel,
  SessionManagementController,
  SessionManagementViewModel,
  SessionSearchResult,
} from '@svton/agent-client';
import type { SessionSearchModel } from '@svton/agent-ui';

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'plugins'
  | 'agents' | 'worktrees' | 'chronicle' | 'integrations' | 'settings';

export interface DesktopSidebarProps {
  config: AgentConfig | null;
  activityBySessionId: ReadonlyMap<string, SessionActivityViewModel>;
  managementBySessionId: ReadonlyMap<string, SessionManagementViewModel>;
  managementActions: SessionManagementController;
  sessionSearch: SessionSearchModel;
  searchResults: SessionSearchResult[];
  activeSessions: SessionSearchResult['session'][];
  currentSessionId: string | null;
  projects: Project[];
  currentProjectId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void;
  onNavigate: (view: View) => void;
  onSwitchProject: (id: string | null) => void;
  onOpenProjectFolder: () => void;
  onDeleteProject: (id: string) => void;
  activeView: View;
  className?: string;
}
