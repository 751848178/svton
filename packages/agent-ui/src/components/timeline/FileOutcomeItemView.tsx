import React, { useState } from 'react';
import { useI18n } from '@svton/ui';
import { DiffView } from '../chat/DiffView';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import { TIMELINE_ACTION_CLASS } from './timeline-action.styles';
import type {
  FileOutcomeItemView as FileItem,
  TimelineHostCapabilities,
  TimelineHostIntent,
  TimelineHostIntentHandler,
} from './timeline.types';
import { copyTargetLabel } from './timeline-execution-copy';
import { fileChangeTypeKey, fileOutcomeSummary, fileOutcomeTitle } from './timeline-file-copy';
import { timelineStatusKey } from './timeline-status-copy';

interface Props {
  item: FileItem;
  capabilities: TimelineHostCapabilities;
  onIntent?: TimelineHostIntentHandler;
}

export function FileOutcomeItemView({ item, capabilities, onIntent }: Props) {
  const { formatNumber, translate: t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const detailsId = `file-outcome-details-${stableToken(item.id)}`;
  const diff = item.changes.flatMap((change) => change.diff ? [change.diff] : []).join('\n');
  const hasDetails = Boolean(diff || item.detail);
  const openUnavailable = !capabilities.openPath;

  async function dispatch(intent: TimelineHostIntent) {
    const result = await onIntent?.(intent);
    setFeedback(result?.status === 'unavailable'
      ? result.message ?? t('timeline.unavailable.generic')
      : undefined);
  }

  return (
    <article
      aria-live="off"
      className="mb-2 rounded-lg border border-border bg-card p-3 text-xs"
      data-testid="timeline-file-outcome"
      data-timeline-id={item.id}
      data-source-call-ids={item.sourceCallIds.join(' ')}
      data-file-scope={item.scope}
      data-file-status={item.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-foreground">{fileOutcomeTitle(item, t, formatNumber)}</strong>
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
          <TimelineStatusIcon status={item.status} />{t(timelineStatusKey(item.status))}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">{fileOutcomeSummary(item, t, formatNumber)}</p>
      <div className="mt-2 space-y-2">
        {item.changes.map((change) => (
          <div key={change.sourceCallId} className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-foreground">{change.path}</code>
            <span className="text-muted-foreground">{t(fileChangeTypeKey(change.changeType))}</span>
            <span className="flex items-center gap-1 text-muted-foreground"><TimelineStatusIcon status={change.status} />{t(timelineStatusKey(change.status))}</span>
            {onIntent && (
              <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({
                type: 'copy', target: 'path', value: change.path,
              })}>
                {copyTargetLabel('path', t)}
              </button>
            )}
            <button
              type="button"
              className={TIMELINE_ACTION_CLASS}
              disabled={openUnavailable || !onIntent}
              title={openUnavailable ? t('timeline.unavailable.openPathTitle') : undefined}
              onClick={() => void dispatch({ type: 'open', target: 'path', value: change.path })}
            >
              {t('timeline.action.openPath')}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {diff && onIntent && (
          <button type="button" className={TIMELINE_ACTION_CLASS} onClick={() => void dispatch({ type: 'copy', target: 'diff', value: diff })}>
            {copyTargetLabel('diff', t)}
          </button>
        )}
        {hasDetails && (
          <button
            type="button"
            className={TIMELINE_ACTION_CLASS}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((current) => !current)}
          >
            {t(expanded ? 'timeline.action.hideDetails' : 'timeline.action.showDetails')}
          </button>
        )}
        {openUnavailable && (
          <span role="status" className="text-muted-foreground" data-testid="file-open-unavailable">
            {t('timeline.unavailable.openPath')}
          </span>
        )}
      </div>
      {hasDetails && (
        <div id={detailsId} hidden={!expanded} className="mt-2" data-testid="file-outcome-details">
          {item.detail && <pre className="whitespace-pre-wrap text-destructive">{item.detail}</pre>}
          {item.changes.map((change) => change.diff
            ? <DiffView key={change.sourceCallId} diff={change.diff} className="border-[#3a3a3a]" />
            : null)}
        </div>
      )}
      {feedback && <p role="status" className="mt-2 text-status-warning">{feedback}</p>}
    </article>
  );
}

function stableToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
