import React from 'react';
import { cn } from '@svton/ui';
import { SessionActivityIndicator } from '@svton/agent-ui';
import type { SessionActivityViewModel, SessionSearchResult } from '@svton/agent-client';
import { formatRelativeTime } from './desktop-sidebar-time';

export function DesktopSessionSearchOption({
  result,
  optionId,
  selected,
  archived,
  searching,
  activity,
  onSelect,
  onActivate,
}: {
  result: SessionSearchResult;
  optionId: string;
  selected: boolean;
  archived: boolean;
  searching: boolean;
  activity?: SessionActivityViewModel;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const session = result.session;
  const title = session.title || '新对话';
  const disabled = archived || searching;
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      onPointerMove={() => { if (!searching) onSelect(session.id); }}
      onClick={() => {
        if (searching) return;
        onSelect(session.id);
        if (!archived) onActivate(session.id);
      }}
      className={cn(
        'mx-1 rounded-md px-3 py-2.5 text-left text-sm outline-none',
        selected && 'bg-muted text-foreground',
        !selected && 'text-foreground hover:bg-muted/60',
        disabled ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <SessionActivityIndicator sessionId={session.id} activity={activity} announce={false} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(session.updatedAt)}
        </span>
      </div>
      {archived && (
        <div className="mt-1 text-xs text-status-warning">已归档 · 取消归档后打开</div>
      )}
      {result.snippet && (
        <div className="mt-1 truncate text-xs text-muted-foreground">
          消息内容（svton 扩展）: {result.snippet}
        </div>
      )}
    </div>
  );
}
