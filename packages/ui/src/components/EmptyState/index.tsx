import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  text?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function EmptyState(props: EmptyStateProps) {
  const { text = 'No data', description, action, className, align = 'center', justify = 'center' } = props;

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
      <div className="text-base text-black/70">{text}</div>
      {description && <div className="text-sm text-black/50">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const Empty = EmptyState;
