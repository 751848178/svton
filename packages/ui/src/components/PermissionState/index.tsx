import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface PermissionStateProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function PermissionState(props: PermissionStateProps) {
  const {
    title = 'Access Denied',
    message = 'You do not have permission to view this content.',
    action,
    className,
    align = 'center',
    justify = 'center',
  } = props;

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
      <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(245, 158, 11)" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="text-base font-medium text-black/85">{title}</div>
      {message && <div className="text-sm text-black/50 max-w-[300px]">{message}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const Permission = PermissionState;
