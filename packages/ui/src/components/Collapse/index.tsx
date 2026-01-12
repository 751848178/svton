import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CollapseItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
  className?: string;
}

export function CollapseItem(props: CollapseItemProps) {
  const { title, children, defaultOpen = false, disabled = false, extra, className } = props;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-b border-black/5', className)}>
      <div
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex items-center justify-between px-4 py-3 select-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn('transition-transform duration-200', open && 'rotate-90')}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium">{title}</span>
        </div>
        {extra}
      </div>
      {open && <div className="px-4 pb-4 pl-9">{children}</div>}
    </div>
  );
}

export interface CollapseProps {
  children: ReactNode;
  bordered?: boolean;
  className?: string;
}

export function Collapse(props: CollapseProps) {
  const { children, bordered = true, className } = props;

  return (
    <div className={cn(bordered && 'border border-black/5 rounded-lg overflow-hidden', className)}>
      {children}
    </div>
  );
}
