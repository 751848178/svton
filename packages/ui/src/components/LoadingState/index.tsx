import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps {
  text?: ReactNode;
  spinner?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function LoadingState(props: LoadingStateProps) {
  const { text = 'Loading...', spinner = true, className, align = 'center', justify = 'center' } = props;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-6',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        justify === 'start' && 'justify-start',
        justify === 'center' && 'justify-center',
        justify === 'end' && 'justify-end',
        className
      )}
    >
      {spinner && (
        <div className="size-6 rounded-full border-[3px] border-black/10 border-t-black/60 animate-spin" />
      )}
      {text && <div className="text-sm text-black/60">{text}</div>}
    </div>
  );
}

export const Loading = LoadingState;
