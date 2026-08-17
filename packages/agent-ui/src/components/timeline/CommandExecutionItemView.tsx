import React, { useState } from 'react';
import { useI18n } from '@svton/ui';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import { TIMELINE_ACTION_CLASS } from './timeline-action.styles';
import type {
  CommandExecutionItemView as CommandItem,
  TimelineCopyTarget,
  TimelineHostIntent,
  TimelineHostCapabilities,
  TimelineHostIntentHandler,
} from './timeline.types';
import { copyTargetLabel, durationLabel, executionTitle } from './timeline-execution-copy';
import { timelineStatusKey } from './timeline-status-copy';

export interface CommandExecutionItemViewProps {
  item: CommandItem;
  capabilities: TimelineHostCapabilities;
  onIntent?: TimelineHostIntentHandler;
}

export function CommandExecutionItemView({
  item,
  capabilities,
  onIntent,
}: CommandExecutionItemViewProps) {
  const { formatNumber, translate: t } = useI18n();
  const [feedback, setFeedback] = useState<string>();
  const failed = item.status === 'failed';
  const terminalAvailable = capabilities.openTerminal && Boolean(item.terminalReference);
  async function dispatch(intent: TimelineHostIntent, fallback = t('timeline.unavailable.generic')) {
    const result = await onIntent?.(intent);
    setFeedback(result?.status === 'unavailable' ? result.message ?? fallback : undefined);
  }
  return (
    <article
      aria-live="off"
      className="mb-2 rounded-lg border border-border bg-card p-3 text-xs"
      data-testid={`timeline-command-${item.id}`}
      data-timeline-status={item.status}
      data-timeline-tool-name={item.toolName}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className={failed ? 'text-destructive' : 'text-foreground'}>{executionTitle(item, t)}</strong>
        <span className="flex items-center gap-1 text-muted-foreground">
          <TimelineStatusIcon status={item.status} />{t(timelineStatusKey(item.status))}
        </span>
      </div>
      {item.command && <OutputField label={t('timeline.field.command')} value={item.command} testId="command-value" />}
      {item.stdout && <OutputField label={t('timeline.field.stdout')} value={item.stdout} testId="command-stdout" />}
      {item.stderr && <OutputField label={t('timeline.field.stderr')} value={item.stderr} testId="command-stderr" failure />}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        {item.exitCode !== undefined && <span data-testid="command-exit-code">{t('timeline.field.exitCode', { code: String(item.exitCode) })}</span>}
        {item.signal && <span>{t('timeline.field.signal', { signal: item.signal })}</span>}
        {item.timedOut && <span>{t('timeline.field.timedOut')}</span>}
        {item.durationMs !== undefined && (
          <span data-testid="command-duration">{durationLabel(item.durationMs, t, formatNumber)}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {copyButton('command', item.command, t, dispatch, onIntent)}
        {copyButton('stdout', item.stdout, t, dispatch, onIntent)}
        {copyButton('stderr', item.stderr, t, dispatch, onIntent)}
        {item.retry && onIntent && (
          <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({ type: 'retry', descriptor: item.retry! })}>{t('action.retry')}</button>
        )}
        <button
          type="button"
          className={TIMELINE_ACTION_CLASS}
          disabled={!terminalAvailable || !onIntent}
          title={terminalAvailable && onIntent
            ? t('timeline.action.openTerminal')
            : t('timeline.unavailable.terminalTitle')}
          onClick={() => item.terminalReference && void dispatch(
            { type: 'openTerminal', terminalReference: item.terminalReference },
            t('timeline.unavailable.terminalTitle'),
          )}
        >
          {t('timeline.action.openTerminal')}
        </button>
      </div>
      {feedback && <p role="status" className="mt-2 text-status-warning">{feedback}</p>}
    </article>
  );
}

function OutputField({
  label, value, testId, failure,
}: { label: string; value: string; testId: string; failure?: boolean }) {
  return (
    <div className="mt-2">
      <div className={failure ? 'text-destructive' : 'text-muted-foreground'}>{label}</div>
      <pre data-testid={testId} className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-foreground">{value}</pre>
    </div>
  );
}

function copyButton(
  target: TimelineCopyTarget,
  value: string | undefined,
  translate: ReturnType<typeof useI18n>['translate'],
  dispatch: (intent: TimelineHostIntent) => Promise<void>,
  onIntent?: TimelineHostIntentHandler,
) {
  if (!value || !onIntent) return null;
  return <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({ type: 'copy', target, value })}>{copyTargetLabel(target, translate)}</button>;
}
