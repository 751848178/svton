import React, { useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import { DiffView } from '../DiffView';
import type { ArtifactChange, ArtifactTarget } from '../../artifacts/artifact.types';

export type FileChangeEntry = ArtifactChange;

interface FileChangeViewProps {
  changes: FileChangeEntry[];
  className?: string;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
}

const CHANGE_STYLE: Record<string, { color: string }> = {
  create: { color: 'text-green-400' },
  modify: { color: 'text-yellow-400' },
  delete: { color: 'text-red-400' },
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
export const FileChangeView: React.FC<FileChangeViewProps> = ({ changes, className, artifactId, onArtifactOpen }) => {
  const { translate: t } = useI18n();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!changes.length) return null;

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      {/* Summary header */}
      <div className="flex min-h-11 items-center gap-2 border-b border-[#3a3a3a] px-3 py-1.5">
        <span className="flex-1 text-[11px] text-gray-400">
          {t(changes.length === 1 ? 'block.file_change.summaryOne' : 'block.file_change.summary', { count: changes.length })}
        </span>
        {artifactId && onArtifactOpen && (
          <button type="button" onClick={() => onArtifactOpen({ kind: 'diff', id: artifactId, title: t('block.file_change.panelTitle'), changes })} className="min-h-11 rounded-lg px-3 text-xs text-cyan-400 hover:bg-[#333]">{t('action.openContentPanel')}</button>
        )}
      </div>

      {/* File list */}
      <div className="divide-y divide-[#252525]">
        {changes.map((change, i) => {
          const style = CHANGE_STYLE[change.changeType] || CHANGE_STYLE.modify;
          const isExpanded = expandedIdx === i;
          const hasDiff = change.diff && change.diff.trim().length > 0;

          return (
            <div key={`${change.path}:${i}`}>
              <button
                type="button"
                onClick={() => hasDiff && setExpandedIdx(isExpanded ? null : i)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left transition-colors',
                  hasDiff && 'hover:bg-[#2a2a2a] cursor-pointer',
                )}
              >
                <span className={cn('w-8 text-[10px]', style.color)}>
                  {t(`block.file_change.${change.changeType}`)}
                </span>
                <span className="text-[11px] text-gray-300 font-mono truncate flex-1">
                  {shortenPath(change.path)}
                </span>
                {hasDiff && (
                  <span className="text-gray-600 text-[10px] flex-shrink-0">
                    {t(isExpanded ? 'action.collapse' : 'action.expand')}
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
