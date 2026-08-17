import React from 'react';
import { cn } from '@svton/ui';
import { SessionActivityIndicator, SessionManagementMenu } from '@svton/agent-ui';
import type {
  SessionActivityViewModel,
  SessionInfo,
  SessionManagementController,
  SessionManagementViewModel,
} from '@svton/agent-client';

export function DesktopSessionRow({
  session,
  activity,
  active,
  management,
  managementActions,
  onSwitch,
}: {
  session: SessionInfo;
  activity?: SessionActivityViewModel;
  active: boolean;
  management?: SessionManagementViewModel;
  managementActions: SessionManagementController;
  onSwitch: () => void;
}) {
  const title = session.title || '新对话';
  return (
    <div className="relative mb-0.5 ml-3 flex items-center gap-1">
      <button
        type="button"
        disabled={management?.isArchived}
        onClick={onSwitch}
        aria-label={`${title}. ${activity?.statusDescription ?? 'Conversation'}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12px] transition-colors',
          active
            ? 'bg-[#2a2a2a] text-white'
            : 'text-gray-400 hover:bg-[#2a2a2a]/60 hover:text-gray-200',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{title}</span>
          {management?.isArchived && <span className="block text-[10px] text-amber-500">取消归档后打开</span>}
        </span>
        {management?.isPinned && <span className="text-[9px] text-gray-600">置顶</span>}
        <SessionActivityIndicator sessionId={session.id} activity={activity} />
      </button>
      {management && <SessionManagementMenu title={title} model={management} actions={managementActions} />}
    </div>
  );
}
