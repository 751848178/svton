import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ScrollAreaProps {
  children: ReactNode;
  maxHeight?: number | string;
  hideScrollbar?: boolean;
  className?: string;
}

export function ScrollArea(props: ScrollAreaProps) {
  const { children, maxHeight, hideScrollbar = false, className } = props;

  return (
    <div
      className={cn(
        'overflow-auto',
        hideScrollbar && 'scrollbar-none',
        className
      )}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}
