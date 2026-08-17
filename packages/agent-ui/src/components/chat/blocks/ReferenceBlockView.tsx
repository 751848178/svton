import React from 'react';
import { cn } from '@svton/ui';
import type { ArtifactTarget } from '../../artifacts/artifact.types';

export interface ReferenceEntry {
  path: string;
  line?: number;
  snippet?: string;
}

interface ReferenceBlockViewProps {
  refs: ReferenceEntry[];
  className?: string;
  onOpen?: (path: string, line?: number) => void;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
}

function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return '.../' + parts.slice(-3).join('/');
}

/**
 * Inline reference block — shows file/symbol references as clickable cards.
 */
export const ReferenceBlockView: React.FC<ReferenceBlockViewProps> = ({ refs, className, onOpen, artifactId, onArtifactOpen }) => {
  if (!refs.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5 my-1', className)}>
      {refs.map((ref, i) => (
        <button
          key={i}
          type="button"
          onClick={() => artifactId && onArtifactOpen
            ? onArtifactOpen({ kind: 'reference', id: `${artifactId}:reference:${i}`, path: ref.path, line: ref.line, snippet: ref.snippet })
            : onOpen?.(ref.path, ref.line)}
          disabled={!onOpen && !(artifactId && onArtifactOpen)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1 text-[11px] transition-colors',
            onOpen || (artifactId && onArtifactOpen)
              ? 'border-[#3a3a3a] bg-[#2a2a2a] hover:bg-[#2a2a2a] hover:border-[#444] cursor-pointer'
              : 'border-[#383838] bg-[#2a2a2a] cursor-default',
          )}
          title={ref.path}
        >
          <span className="font-mono text-gray-300 truncate max-w-[200px]">{shortenPath(ref.path)}</span>
          {ref.line != null && (
            <span className="text-[10px] text-gray-600">:{ref.line}</span>
          )}
          {ref.snippet && (
            <span className="text-gray-600 truncate max-w-[150px] hidden sm:inline">{ref.snippet}</span>
          )}
        </button>
      ))}
    </div>
  );
};
