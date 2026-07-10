import React, { useState } from 'react';
import { cn, t } from '@svton/ui';
import { DiffView } from '../DiffView';

export interface FileChangeEntry {
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  diff?: string;
}

interface FileChangeViewProps {
  changes: FileChangeEntry[];
  className?: string;
}

const CHANGE_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  create: { label: '+', color: 'text-green-400', icon: 'green' },
  modify: { label: '~', color: 'text-yellow-400', icon: 'yellow' },
  delete: { label: '-', color: 'text-red-400', icon: 'red' },
};

function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return '.../' + parts.slice(-2).join('/');
}

/**
 * Inline file change block — shows file list with change type indicators.
 * Click a file to expand its diff.
 */
export const FileChangeView: React.FC<FileChangeViewProps> = ({ changes, className }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!changes.length) return null;

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      {/* Summary header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#3a3a3a]">
        <span className="text-xs">📄</span>
        <span className="text-[11px] text-gray-400">
          {changes.length} {changes.length === 1 ? 'file' : 'files'} changed
        </span>
      </div>

      {/* File list */}
      <div className="divide-y divide-[#252525]">
        {changes.map((change, i) => {
          const style = CHANGE_STYLE[change.changeType] || CHANGE_STYLE.modify;
          const isExpanded = expandedIdx === i;
          const hasDiff = change.diff && change.diff.trim().length > 0;

          return (
            <div key={i}>
              <button
                onClick={() => hasDiff && setExpandedIdx(isExpanded ? null : i)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                  hasDiff && 'hover:bg-[#2a2a2a] cursor-pointer',
                )}
              >
                <span className={cn('text-xs font-mono w-3 text-center', style.color)}>
                  {style.label}
                </span>
                <span className="text-[11px] text-gray-300 font-mono truncate flex-1">
                  {shortenPath(change.path)}
                </span>
                {hasDiff && (
                  <span className="text-gray-600 text-[10px] flex-shrink-0">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                )}
              </button>
              {isExpanded && hasDiff && (
                <div className="px-2 pb-2">
                  <DiffView diff={change.diff!} className="border-[#3a3a3a]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
