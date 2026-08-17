import React from 'react';
import { cn } from '@svton/ui';
import { TimelineStatusIcon } from '../../timeline/TimelineStatusIcon';

interface ProgressBlockViewProps {
  text: string;
  status: 'running' | 'done';
  className?: string;
}

/**
 * Inline progress block — transient status indicator.
 * State is conveyed by the shared transcript status icon and visible text.
 */
export const ProgressBlockView: React.FC<ProgressBlockViewProps> = ({ text, status, className }) => {
  const isRunning = status === 'running';
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 my-0.5', className)}>
      <TimelineStatusIcon status={status} />
      <span className={cn('text-[11px]', isRunning ? 'text-foreground' : 'text-muted-foreground')}>
        {text}
      </span>
    </div>
  );
};
