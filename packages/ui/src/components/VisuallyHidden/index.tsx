import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface VisuallyHiddenProps {
  children: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export function VisuallyHidden(props: VisuallyHiddenProps) {
  const { children, as: Component = 'span', className } = props;

  return (
    <Component className={cn('sr-only', className)}>
      {children}
    </Component>
  );
}
