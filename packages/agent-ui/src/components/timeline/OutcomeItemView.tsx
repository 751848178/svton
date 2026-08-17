import React, { useState } from 'react';
import { useI18n } from '@svton/ui';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import { TIMELINE_ACTION_CLASS } from './timeline-action.styles';
import type { DiagnosticItemView, TimelineHostIntentHandler } from './timeline.types';
import { copyTargetLabel } from './timeline-execution-copy';

export function OutcomeItemView({
  item,
  onIntent,
}: { item: DiagnosticItemView; onIntent?: TimelineHostIntentHandler }) {
  const { translate: t } = useI18n();
  const [feedback, setFeedback] = useState<string>();
  const failed = item.kind === 'error';
  const diagnostic = item.code === 'agent_run_failed'
    ? t('timeline.outcome.agentRunFailed')
    : item.diagnostic;
  async function dispatch(intent: Parameters<TimelineHostIntentHandler>[0]) {
    const result = await onIntent?.(intent);
    setFeedback(result?.status === 'unavailable'
      ? result.message ?? t('timeline.unavailable.generic')
      : undefined);
  }
  return (
    <article
      aria-live="off"
      className={failed
        ? 'mb-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs'
        : 'mb-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs'}
      data-testid={`timeline-${item.kind}`}
    >
      <strong className={failed ? 'flex items-center gap-1 text-destructive' : 'flex items-center gap-1 text-status-warning'}>
        <TimelineStatusIcon status={failed ? 'failed' : 'warning'} />
        {t(failed ? 'timeline.title.providerError' : 'timeline.title.warning')}
      </strong>
      <div
        className="mt-1 whitespace-pre-wrap text-foreground"
        data-testid={failed ? 'message-error' : undefined}
      >
        {diagnostic}
      </div>
      <div className="mt-2 flex gap-2">
        {onIntent && (
          <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({
            type: 'copy', target: 'diagnostic', value: item.diagnostic,
          })}>
            {copyTargetLabel('diagnostic', t)}
          </button>
        )}
        {item.retry && onIntent && (
          <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({ type: 'retry', descriptor: item.retry! })}>{t('action.retry')}</button>
        )}
      </div>
      {feedback && <p role="status" className="mt-2 text-status-warning">{feedback}</p>}
    </article>
  );
}
