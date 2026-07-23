import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface DividerProps {
  type?: 'horizontal' | 'vertical';
  children?: ReactNode;
  orientation?: 'left' | 'center' | 'right';
  dashed?: boolean;
  className?: string;
}

export function Divider(props: DividerProps) {
  const { type = 'horizontal', children, orientation = 'center', dashed = false, className } = props;

  if (type === 'vertical') {
    return <span className={cn('inline-block w-px h-[1em] mx-2 align-middle bg-border', className)} />;
  }

  if (!children) {
    return <div className={cn('my-6 border-t', dashed ? 'border-dashed' : 'border-solid', 'border-border', className)} />;
  }

  return (
    <div className={cn('flex items-center my-6', className)}>
      <div className={cn('flex-1 border-t', dashed ? 'border-dashed' : 'border-solid', 'border-border', orientation === 'left' && 'flex-[0.05]')} />
      <span className="px-4 text-sm text-muted-foreground whitespace-nowrap">{children}</span>
      <div className={cn('flex-1 border-t', dashed ? 'border-dashed' : 'border-solid', 'border-border', orientation === 'right' && 'flex-[0.05]')} />
    </div>
  );
}
