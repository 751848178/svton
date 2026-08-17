import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { CompletedIcon, ErrorIcon } from '../../icons';
import { useI18n } from '../../i18n';

export interface ProgressStateProps {
  percent: number;
  status?: 'active' | 'success' | 'error';
  text?: ReactNode;
  showPercent?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function ProgressState(props: ProgressStateProps) {
  const { translate } = useI18n();
  const { percent, status = 'active', text, showPercent = true, className, align = 'center' } = props;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const statusColors = {
    active: 'bg-info',
    success: 'bg-success',
    error: 'bg-destructive',
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-6 w-full',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        className
      )}
    >
      <div className="w-full max-w-[300px]">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', statusColors[status])}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'success' && (
          <CompletedIcon size={16} className="text-success" role="img" aria-label={translate('status.success')} />
        )}
        {status === 'error' && (
          <ErrorIcon size={16} className="text-destructive" role="img" aria-label={translate('status.failed')} />
        )}
        {showPercent && <span className="text-sm text-muted-foreground">{clampedPercent}%</span>}
        {text && <span className="text-sm text-muted-foreground">{text}</span>}
      </div>
    </div>
  );
}

export const Progress = ProgressState;
