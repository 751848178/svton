import React from 'react';
import { useSession } from '@svton/agent-client';
import { useI18n } from '@svton/ui';
import { Sidebar, type View } from './Sidebar';

export function WebSessionSidebar({
  session,
  view,
  onNavigate,
}: {
  session: ReturnType<typeof useSession>;
  view: View;
  onNavigate: (view: View) => void;
}) {
  const { translate: t } = useI18n();
  const rows = session.search.results.map((result) => ({
    id: result.session.id,
    title: result.session.title || t('web.session.untitled'),
    activity: session.activityBySessionId.get(result.session.id),
    management: session.managementBySessionId.get(result.session.id),
    snippet: result.snippet,
    snippetSource: result.source,
  }));
  return (
    <Sidebar
      sessions={rows}
      currentSessionId={session.currentSessionId}
      onNewChat={() => { void session.create(); onNavigate('chat'); }}
      onSwitchSession={session.switchTo}
      managementActions={session.management}
      sessionSearch={session.search}
      onNavigate={onNavigate}
      activeView={view}
    />
  );
}
