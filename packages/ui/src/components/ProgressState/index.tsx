import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ProgressStateProps {
  percent: number;
  status?: 'active' | 'success' | 'error';
  text?: ReactNode;
  showPercent?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function ProgressState(props: ProgressStateProps) {
  const { percent, status = 'active', text, showPercent = true, className, align = 'center' } = props;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const statusColors = {
    active: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-6 w-full',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        className
      )}
    >
      <div className="w-full max-w-[300px]">
        <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', statusColors[status])}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'success' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === 'error' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {showPercent && <span className="text-sm text-black/60">{clampedPercent}%</span>}
        {text && <span className="text-sm text-black/60">{text}</span>}
      </div>
    </div>
  );
}

export const Progress = ProgressState;
