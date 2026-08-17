import React, { useState } from 'react';
import { useI18n } from '@svton/ui';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import { TIMELINE_ACTION_CLASS } from './timeline-action.styles';
import type { TimelineHostIntentHandler, ToolExecutionItemView as ToolItem } from './timeline.types';
import { copyTargetLabel, executionTitle } from './timeline-execution-copy';
import { timelineStatusKey } from './timeline-status-copy';

export function ToolExecutionItemView({
  item,
  onIntent,
}: { item: ToolItem; onIntent?: TimelineHostIntentHandler }) {
  const { translate: t } = useI18n();
  const [feedback, setFeedback] = useState<string>();
  const failed = item.status === 'failed';
  async function dispatch(intent: Parameters<TimelineHostIntentHandler>[0]) {
    const result = await onIntent?.(intent);
    setFeedback(result?.status === 'unavailable'
      ? result.message ?? t('timeline.unavailable.generic')
      : undefined);
  }
  return (
    <article
      aria-live="off"
      className="mb-2 rounded-lg border border-border bg-card p-3 text-xs"
      data-testid={`timeline-tool-${item.id}`}
      data-timeline-status={item.status}
      data-timeline-tool-name={item.toolName}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className={failed ? 'text-destructive' : 'text-foreground'}>{executionTitle(item, t)}</strong>
        <span className="flex items-center gap-1 text-muted-foreground">
          <TimelineStatusIcon status={item.status} />{t(timelineStatusKey(item.status))}
        </span>
      </div>
      {item.result && (
        <pre data-testid="tool-result" className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-foreground">
          {item.result}
        </pre>
      )}
      <div className="mt-2 flex gap-2">
        {item.result && onIntent && (
          <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({ type: 'copy', target: 'result', value: item.result! })}>
            {copyTargetLabel('result', t)}
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
