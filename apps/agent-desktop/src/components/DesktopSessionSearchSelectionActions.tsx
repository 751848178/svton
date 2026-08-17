import React from 'react';

export function DesktopSessionSearchSelectionActions({
  title,
  pending,
  onUnarchive,
}: {
  title: string;
  pending: boolean;
  onUnarchive: () => void;
}) {
  return (
    <div className="border-t border-border px-3 py-2">
      <button
        type="button"
        disabled={pending}
        onClick={onUnarchive}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-muted px-3 text-sm font-medium text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        aria-label={`取消归档“${title}”`}
      >
        {pending ? '正在取消归档…' : '取消归档'}
      </button>
    </div>
  );
}
