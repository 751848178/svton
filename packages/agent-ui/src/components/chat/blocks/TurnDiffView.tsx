import React, { useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import { DiffView } from '../DiffView';
import type { FileChangeEntry } from './FileChangeView';
import type { ArtifactTarget } from '../../artifacts/artifact.types';

interface TurnDiffViewProps {
  changes: FileChangeEntry[];
  className?: string;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
}

/**
 * Aggregated turn diff — summarizes all file changes across a single assistant turn.
 * Shows total additions/deletions + expandable per-file diffs.
 */
export const TurnDiffView: React.FC<TurnDiffViewProps> = ({ changes, className, artifactId, onArtifactOpen }) => {
  const { translate: t } = useI18n();
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
      <div className="flex min-h-11 items-center gap-3 px-3 py-2">
        <span className="text-[11px] text-gray-300 flex-1">
          {t(changes.length === 1 ? 'block.file_change.summaryOne' : 'block.file_change.summary', { count: changes.length })}
        </span>
        {additions > 0 && (
          <span className="text-[11px] text-green-400 font-mono">+{additions}</span>
        )}
        {deletions > 0 && (
          <span className="text-[11px] text-red-400 font-mono">-{deletions}</span>
        )}
        {artifactId && onArtifactOpen && (
          <button type="button" onClick={() => onArtifactOpen({ kind: 'diff', id: artifactId, title: t('block.turn_diff.title'), changes })} className="min-h-11 rounded-lg px-3 text-xs text-cyan-400 hover:bg-[#333]">{t('action.openContentPanel')}</button>
        )}
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="min-h-11 rounded-lg px-3 text-xs text-gray-400 hover:bg-[#333]">{t(expanded ? 'action.collapse' : 'action.expand')}</button>
      </div>

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
                  {t(`block.file_change.${change.changeType}`)}
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
