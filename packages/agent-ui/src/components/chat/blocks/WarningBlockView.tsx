import React from 'react';
import { cn } from '@svton/ui';
import { TimelineStatusIcon } from '../../timeline/TimelineStatusIcon';

interface WarningBlockViewProps {
  text: string;
  source?: string;
  className?: string;
}

/**
 * Inline non-fatal warning with an optional source tag.
 */
export const WarningBlockView: React.FC<WarningBlockViewProps> = ({ text, source, className }) => {
  return (
    <div className={cn(
      'mt-2 flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2',
      className,
    )}>
      <TimelineStatusIcon status="warning" className="mt-px" />
      <div className="min-w-0 flex-1">
        <span className="text-[12px] leading-relaxed text-foreground">{text}</span>
        {source && (
          <span className="ml-2 rounded border border-status-warning/40 px-1 py-0.5 text-[10px] text-status-warning">
            {source}
          </span>
        )}
      </div>
    </div>
  );
};
