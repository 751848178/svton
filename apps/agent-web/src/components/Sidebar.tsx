'use client';

import React from 'react';
import {
  AgentIcon,
  AutomationIcon,
  ChatIcon,
  IntegrationIcon,
  SearchIcon,
  SkillIcon,
  useI18n,
} from '@svton/ui';
import {
  Sidebar as AgentSidebar,
  type SessionManagementActions,
  type SessionSearchModel,
  type SidebarItem,
  type SidebarSession,
} from '@svton/agent-ui';

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'agents' | 'integrations' | 'settings';

interface WebSidebarProps {
  sessions: SidebarSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void | Promise<void>;
  managementActions: SessionManagementActions;
  sessionSearch: SessionSearchModel;
  onNavigate: (view: View) => void;
  activeView: View;
}

const iconProps = { size: 15, strokeWidth: 1.5, 'aria-hidden': true } as const;

export function Sidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSwitchSession,
  managementActions,
  sessionSearch,
  onNavigate,
  activeView,
}: WebSidebarProps) {
  const { translate: t } = useI18n();
  const items: SidebarItem[] = [
    { id: 'search', label: t('web.nav.search'), icon: <SearchIcon {...iconProps} />, action: () => onNavigate(activeView === 'search' ? 'chat' : 'search'), view: 'search' },
    { id: 'automation', label: t('web.nav.automation'), icon: <AutomationIcon {...iconProps} />, action: () => onNavigate(activeView === 'automation' ? 'chat' : 'automation'), view: 'automation' },
    { id: 'chat', label: t('web.nav.chat'), icon: <ChatIcon {...iconProps} />, view: 'chat' },
    { id: 'skills', label: t('web.nav.skills'), icon: <SkillIcon {...iconProps} />, action: () => onNavigate(activeView === 'skills' ? 'chat' : 'skills'), view: 'skills' },
    { id: 'agents', label: t('web.nav.agents'), icon: <AgentIcon {...iconProps} />, action: () => onNavigate(activeView === 'agents' ? 'chat' : 'agents'), view: 'agents' },
    { id: 'integrations', label: t('web.nav.integrations'), icon: <IntegrationIcon {...iconProps} />, action: () => onNavigate(activeView === 'integrations' ? 'chat' : 'integrations'), view: 'integrations' },
  ];
  return (
    <AgentSidebar
      config={{
        title: 'Svton',
        items,
        width: 240,
        collapsible: false,
        showNewChat: true,
        showSessions: true,
        showSettings: true,
      }}
      sessions={sessions}
      currentSessionId={activeView === 'chat' ? currentSessionId : null}
      onNewChat={onNewChat}
      onSwitchSession={(id) => { onNavigate('chat'); return onSwitchSession(id); }}
      managementActions={managementActions}
      sessionSearch={sessionSearch}
      onNavigate={(next) => onNavigate(next as View)}
      activeView={activeView}
      onOpenSettings={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')}
    />
  );
}
