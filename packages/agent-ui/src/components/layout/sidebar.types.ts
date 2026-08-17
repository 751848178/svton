import type React from 'react';
import type { SessionActivityIndicatorModel } from './SessionActivityIndicator';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  view?: string;
  action?: () => void;
  badge?: number | string;
  visible?: boolean;
  collapsedTooltip?: string;
}

export interface SidebarConfig {
  items: SidebarItem[];
  showSettings?: boolean;
  showNewChat?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  width?: number;
  collapsedWidth?: number;
  showSessions?: boolean;
  title?: string;
  collapseStorageKey?: string | false;
}

export interface SidebarSession {
  id: string;
  title: string;
  activity?: SessionActivityIndicatorModel;
  snippet?: string;
  snippetSource?: 'svton-content-extension';
  management?: SessionManagementModel;
}

export type SessionManagementCommand =
  | 'rename' | 'pin' | 'unpin' | 'archive' | 'stopAndArchive' | 'unarchive' | 'delete';

export interface SessionManagementModel {
  sessionId: string;
  isPinned: boolean;
  isArchived: boolean;
  isRunning: boolean;
  commands: readonly SessionManagementCommand[];
}

export interface SessionManagementActions {
  rename: (id: string, title: string) => Promise<{ ok: boolean; reason?: string }>;
  setPinned: (id: string, pinned: boolean) => Promise<{ ok: boolean; reason?: string }>;
  archive: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  stopAndArchive: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  unarchive: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  deletePermanently: (id: string) => Promise<void>;
}

export interface SessionSearchModel {
  query: string;
  scope: 'active' | 'archived';
  includeContent: boolean;
  searching: boolean;
  error: 'unavailable' | null;
  setQuery: (value: string) => void;
  setScope: (scope: 'active' | 'archived') => void;
  setIncludeContent: (include: boolean) => void;
  retry: () => void;
}

export interface SidebarProps {
  config: SidebarConfig;
  activeView: string;
  onNavigate: (view: string) => void;
  sessions?: SidebarSession[];
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSwitchSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  managementActions?: SessionManagementActions;
  sessionSearch?: SessionSearchModel;
  onOpenSettings?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
  footer?: React.ReactNode;
}
