import React, { useState } from 'react';
import { cn } from '@svton/ui';
import { DiffView } from '../DiffView';
import type { FileChangeEntry } from './FileChangeView';

interface TurnDiffViewProps {
  changes: FileChangeEntry[];
  className?: string;
}

const CHANGE_LABEL: Record<string, string> = {
  create: '新建',
  modify: '修改',
  delete: '删除',
};

/**
 * Aggregated turn diff — summarizes all file changes across a single assistant turn.
 * Shows total additions/deletions + expandable per-file diffs.
 */
export const TurnDiffView: React.FC<TurnDiffViewProps> = ({ changes, className }) => {
  const [expanded, setExpanded] = useState(false);

  if (!changes.length) return null;

  // Count additions/deletions from diffs
  let additions = 0;
  let deletions = 0;
  for (const change of changes) {
    if (change.diff) {
      for (const line of change.diff.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }
    }
  }

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      {/* Summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors"
      >
        <span className="text-xs">📝</span>
        <span className="text-[11px] text-gray-300 flex-1">
          {changes.length} {changes.length === 1 ? 'file' : 'files'} changed
        </span>
        {additions > 0 && (
          <span className="text-[11px] text-green-400 font-mono">+{additions}</span>
        )}
        {deletions > 0 && (
          <span className="text-[11px] text-red-400 font-mono">-{deletions}</span>
        )}
        <span className="text-gray-500 text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* File list with diffs */}
      {expanded && (
        <div className="border-t border-[#3a3a3a] divide-y divide-[#252525]">
          {changes.map((change, i) => (
            <div key={i} className="px-3 py-1.5">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-[10px] px-1 rounded',
                  change.changeType === 'create' && 'bg-green-900/30 text-green-400',
                  change.changeType === 'modify' && 'bg-yellow-900/30 text-yellow-400',
                  change.changeType === 'delete' && 'bg-red-900/30 text-red-400',
                )}>
                  {CHANGE_LABEL[change.changeType] || change.changeType}
                </span>
                <span className="text-[11px] font-mono text-gray-400 truncate">{change.path}</span>
              </div>
              {change.diff && (
                <DiffView diff={change.diff} className="border-[#3a3a3a]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
