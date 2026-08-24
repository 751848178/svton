import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useI18n } from '../../i18n';

export interface LoadingStateProps {
  text?: ReactNode;
  spinner?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
}

export function LoadingState(props: LoadingStateProps) {
  const { translate } = useI18n();
  const { text, spinner = true, className, align = 'center', justify = 'center' } = props;
  const resolvedText = text ?? translate('ui.loading');

  return (
    <div
      role="status"
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
        <div className="size-6 rounded-full border-[3px] border-muted-foreground/20 border-t-primary animate-spin" />
      )}
      {resolvedText && (
        <div className="text-sm text-muted-foreground" data-svton-loading-text>
          {resolvedText}
        </div>
      )}
    </div>
  );
}

export const Loading = LoadingState;
