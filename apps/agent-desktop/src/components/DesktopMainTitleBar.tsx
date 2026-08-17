import React from 'react';
import { GitBranchIcon, PopoutIcon } from '@svton/ui';
import { startDragging, toggleMaximize } from '@/lib/window-controls';

interface DesktopMainTitleBarProps {
  sessionTitle: string;
  projectName: string | null;
  gitBranch: string | null;
  canPopout: boolean;
  onPopout: () => void;
  compact?: boolean;
}

export function DesktopMainTitleBar({
  sessionTitle,
  projectName,
  gitBranch,
  canPopout,
  onPopout,
  compact = false,
}: DesktopMainTitleBarProps) {
  return (
    <div
      onMouseDown={compact ? undefined : startDragging}
      onDoubleClick={compact ? undefined : toggleMaximize}
      className={compact
        ? 'flex min-w-0 items-center justify-between gap-2'
        : 'flex h-10 shrink-0 cursor-default select-none items-center justify-between border-b border-[#333] bg-[#252525] px-4'}
    >
      <span className="min-w-0 truncate text-[12px] text-gray-400">{sessionTitle}</span>
      <div className="flex shrink-0 items-center gap-2">
        {!compact && projectName && <span className="text-[10px] text-gray-600">{projectName}</span>}
        {!compact && gitBranch && (
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <GitBranchIcon size={10} aria-hidden="true" />
            {gitBranch}
          </span>
        )}
        {canPopout && (
          <button
            type="button"
            aria-label="在新窗口中打开此会话"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onPopout}
            className="flex size-11 items-center justify-center rounded text-gray-600 transition-colors hover:bg-[#2a2a2a] hover:text-gray-300 lg:size-6"
          >
            <PopoutIcon size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
