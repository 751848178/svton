import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  max?: number;
  showZero?: boolean;
  color?: string;
  offset?: [number, number];
  children?: ReactNode;
  className?: string;
}

export function Badge(props: BadgeProps) {
  const { count = 0, dot = false, max = 99, showZero = false, color = '#ef4444', offset = [0, 0], children, className } = props;

  const showBadge = dot || count > 0 || (count === 0 && showZero);
  const displayCount = count > max ? `${max}+` : count;

  const badgeContent = (
    <span
      className={cn(
        'inline-flex items-center justify-center text-xs font-medium text-white rounded-full',
        dot ? 'size-2' : 'min-w-[18px] h-[18px] px-1.5'
      )}
      style={{ backgroundColor: color }}
    >
      {!dot && displayCount}
    </span>
  );

  if (!children) return badgeContent;

  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {showBadge && (
        <span
          className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 ring-2 ring-white rounded-full"
          style={{ marginTop: offset[1], marginRight: -offset[0] }}
        >
          {badgeContent}
        </span>
      )}
    </span>
  );
}
