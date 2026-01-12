import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface AspectRatioProps {
  ratio?: number;
  children: ReactNode;
  className?: string;
}

export function AspectRatio(props: AspectRatioProps) {
  const { ratio = 16 / 9, children, className } = props;

  return (
    <div className={cn('relative w-full', className)} style={{ paddingBottom: `${(1 / ratio) * 100}%` }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
