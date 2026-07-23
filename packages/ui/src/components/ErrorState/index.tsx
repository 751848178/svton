import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function ErrorState(props: ErrorStateProps) {
  const { title = 'Something went wrong', message, action, className, align = 'center', justify = 'center' } = props;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-6',
        align === 'start' && 'items-start text-left',
        align === 'center' && 'items-center text-center',
        align === 'end' && 'items-end text-right',
        justify === 'start' && 'justify-start',
        justify === 'center' && 'justify-center',
        justify === 'end' && 'justify-end',
        className
      )}
    >
      <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-base font-medium text-foreground">{title}</div>
      {message && <div className="text-sm text-muted-foreground">{message}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const Error = ErrorState;
