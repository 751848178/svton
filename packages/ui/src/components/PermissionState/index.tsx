import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { LockIcon } from '../../icons';
import { useI18n } from '../../i18n';

export interface PermissionStateProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function PermissionState(props: PermissionStateProps) {
  const { translate } = useI18n();
  const {
    title = translate('permission.deniedTitle'),
    message = translate('permission.deniedMessage'),
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
      <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center mb-2">
        <LockIcon size={24} className="text-warning" aria-hidden="true" />
      </div>
      <div className="text-base font-medium text-foreground">{title}</div>
      {message && <div className="text-sm text-muted-foreground max-w-[300px]">{message}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const Permission = PermissionState;
