import React from 'react';
import { EyeOffIcon, cn, useI18n } from '@svton/ui';

interface RedactedThinkingViewProps {
  reason?: string;
  className?: string;
}

/**
 * Inline redacted thinking block — placeholder for sensitive/redacted reasoning content.
 */
export const RedactedThinkingView: React.FC<RedactedThinkingViewProps> = ({ reason, className }) => {
  const { translate: t } = useI18n();
  return (
    <div className={cn(
      'my-1 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2',
      className,
    )}>
      <EyeOffIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-[11px] text-muted-foreground">
        {t('block.redacted_thinking')}
      </span>
      {reason && (
        <span className="truncate text-[10px] text-muted-foreground">· {reason}</span>
      )}
    </div>
  );
};
