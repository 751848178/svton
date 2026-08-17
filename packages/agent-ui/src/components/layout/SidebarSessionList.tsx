import React from 'react';
import { cn, useI18n } from '@svton/ui';
import { SessionActivityIndicator } from './SessionActivityIndicator';
import type { SessionManagementActions, SidebarSession } from './sidebar.types';
import { SessionManagementMenu } from './SessionManagementMenu';
import { localizeSessionActivity } from './session-activity-copy';

export function SidebarSessionList({
  sessions,
  currentSessionId,
  onSwitch,
  managementActions,
}: {
  sessions: SidebarSession[];
  currentSessionId: string | null;
  onSwitch: (id: string) => void | Promise<void>;
  managementActions?: SessionManagementActions;
}) {
  const { translate: t } = useI18n();
  if (sessions.length === 0) {
    return <div className="flex-1 py-4 text-center text-xs text-gray-600">{t('session.sidebar.empty')}</div>;
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-1">
      {sessions.map((session) => {
        const activity = session.activity
          ? localizeSessionActivity(session.activity, t)
          : undefined;
        return <div key={session.id} className="group relative mb-0.5 flex items-center gap-1">
          <button
            type="button"
            disabled={session.management?.isArchived}
            onClick={(event) => {
              const target = event.currentTarget;
              void Promise.resolve(onSwitch(session.id)).finally(() => {
                const decisionOpen = document.querySelector('[role="dialog"], [role="alertdialog"]');
                if (target.isConnected && !decisionOpen) target.focus();
              });
            }}
            data-testid="session-item"
            aria-label={`${session.title}. ${activity?.statusDescription ?? t('session.sidebar.conversationFallback')}`}
            aria-current={session.id === currentSessionId ? 'page' : undefined}
            className={cn(
              'flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors max-lg:min-h-11',
              session.id === currentSessionId
                ? 'bg-[#222] text-gray-200'
                : 'text-gray-500 hover:bg-[#2a2a2a]/60 hover:text-gray-300',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{session.title}</span>
              {session.snippet && (
                <span className="mt-0.5 block truncate text-[10px] text-gray-600">
                  {t('session.sidebar.contentMatch', { snippet: session.snippet })}
                </span>
              )}
              {session.management?.isArchived && (
                <span className="mt-0.5 block text-[10px] text-amber-500">{t('session.sidebar.archivedHint')}</span>
              )}
            </span>
            {session.management?.isPinned && <span className="text-[9px] text-gray-500">{t('session.sidebar.pinned')}</span>}
            <SessionActivityIndicator sessionId={session.id} activity={session.activity} />
          </button>
          {managementActions && session.management && (
            <SessionManagementMenu title={session.title} model={session.management} actions={managementActions} />
          )}
        </div>;
      })}
    </div>
  );
}
