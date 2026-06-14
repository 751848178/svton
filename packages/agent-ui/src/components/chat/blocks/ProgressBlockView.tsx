import React from 'react';
import { cn } from '@svton/ui';

interface ProgressBlockViewProps {
  text: string;
  status: 'running' | 'done';
  className?: string;
}

/**
 * Inline progress block — transient status indicator.
 * Running: blue pulsing dot. Done: green checkmark.
 */
export const ProgressBlockView: React.FC<ProgressBlockViewProps> = ({ text, status, className }) => {
  const isRunning = status === 'running';
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 my-0.5', className)}>
      {isRunning ? (
        <span className="text-[10px] text-blue-400 animate-pulse flex-shrink-0">●</span>
      ) : (
        <span className="text-[10px] text-green-400 flex-shrink-0">✓</span>
      )}
      <span className={cn('text-[11px]', isRunning ? 'text-gray-400' : 'text-gray-600')}>
        {text}
      </span>
    </div>
  );
};
