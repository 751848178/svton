import React from 'react';
import { cn } from '@svton/ui';

export interface ReferenceEntry {
  path: string;
  line?: number;
  snippet?: string;
}

interface ReferenceBlockViewProps {
  refs: ReferenceEntry[];
  className?: string;
  onOpen?: (path: string, line?: number) => void;
}

function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return '.../' + parts.slice(-3).join('/');
}

/**
 * Inline reference block — shows file/symbol references as clickable cards.
 */
export const ReferenceBlockView: React.FC<ReferenceBlockViewProps> = ({ refs, className, onOpen }) => {
  if (!refs.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5 my-1', className)}>
      {refs.map((ref, i) => (
        <button
          key={i}
          onClick={() => onOpen?.(ref.path, ref.line)}
          disabled={!onOpen}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-colors',
            onOpen
              ? 'border-[#333] bg-[#1c1c1c] hover:bg-[#222] hover:border-[#444] cursor-pointer'
              : 'border-[#2a2a2a] bg-[#1c1c1c] cursor-default',
          )}
          title={ref.path}
        >
          <span className="text-gray-500">📄</span>
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
