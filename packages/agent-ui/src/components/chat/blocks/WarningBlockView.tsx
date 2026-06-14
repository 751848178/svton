import React from 'react';
import { cn } from '@svton/ui';

interface WarningBlockViewProps {
  text: string;
  source?: string;
  className?: string;
}

/**
 * Inline warning block — yellow ⚠ icon + message + optional source tag.
 * Distinct from error blocks (red ✗) — warnings are non-fatal.
 */
export const WarningBlockView: React.FC<WarningBlockViewProps> = ({ text, source, className }) => {
  return (
    <div className={cn(
      'flex items-start gap-2 mt-2 px-3 py-2 rounded-lg border border-yellow-900/30 bg-yellow-950/20',
      className,
    )}>
      <span className="text-yellow-400 text-xs flex-shrink-0 mt-px">⚠</span>
      <div className="min-w-0 flex-1">
        <span className="text-[12px] text-yellow-200/90 leading-relaxed">{text}</span>
        {source && (
          <span className="ml-2 text-[10px] text-yellow-600 border border-yellow-900/40 rounded px-1 py-0.5">
            {source}
          </span>
        )}
      </div>
    </div>
  );
};
