import React, { useId, useState } from 'react';
import { RunIcon, RunningIcon, cn, useI18n } from '@svton/ui';
import type { ComposerCapability, ComposerIntentResult } from '../composer.types';

interface CommandBlockViewProps {
  label: string;
  action: string;
  icon?: string;
  className?: string;
  capability?: ComposerCapability;
  onCommand?: (action: string) => Promise<ComposerIntentResult>;
}

/** Assistant-authored actions are enabled only after host capability resolution. */
export const CommandBlockView: React.FC<CommandBlockViewProps> = ({
  label, action, className, capability, onCommand,
}) => {
  const { translate: t } = useI18n();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ComposerIntentResult | null>(null);
  const statusId = `${useId().replace(/:/g, '')}-command-status`;
  const supported = capability?.supported === true && Boolean(onCommand) && Boolean(action);
  const unsupportedReason = capability?.supported === false
    ? capability.reason
    : !action ? t('command.missingAction') : t('command.unavailable');

  const execute = async () => {
    if (!supported || !onCommand || pending) return;
    setPending(true);
    try { setResult(await onCommand(action)); }
    finally { setPending(false); }
  };

  return (
    <div className={cn('my-1 inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        onClick={() => void execute()}
        disabled={!supported || pending}
        aria-describedby={statusId}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] transition-colors',
          supported
            ? 'cursor-pointer border-status-info/30 bg-status-info/10 text-status-info hover:bg-status-info/20'
            : 'cursor-not-allowed border-border bg-muted text-muted-foreground',
        )}
      >
        {pending
          ? <RunningIcon size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          : <RunIcon size={14} aria-hidden="true" />}
        <span>{label || action || t('command.unnamed')}</span>
        {pending && <span>{t('command.processing')}</span>}
      </button>
      <span
        id={statusId}
        role={result && result.kind !== 'succeeded' ? 'alert' : 'status'}
        className={cn('text-[10px]', result && result.kind !== 'succeeded' ? 'text-destructive' : 'text-muted-foreground')}
      >
        {result?.message ?? (!supported ? unsupportedReason : '')}
      </span>
    </div>
  );
};
