import React, { useId, useState } from 'react';
import { ChevronIcon, cn, useI18n } from '@svton/ui';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import type { CommandExecutionItemView, TimelineItemView, ToolExecutionItemView } from './timeline.types';
import { executionTitle } from './timeline-execution-copy';

type ProcessItem = ToolExecutionItemView | CommandExecutionItemView;

export function ProcessDisclosure({ items }: { items: ProcessItem[] }) {
  const { translate: t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const reactId = useId().replace(/:/g, '');
  const regionId = `timeline-process-${reactId}`;
  if (items.length === 0) return null;
  const last = items.at(-1);
  const latest = latestProgress(items)
    ?? (last ? executionTitle(last, t) : t('block.progress.running'));

  return (
    <section className="mb-2" data-testid="timeline-process">
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-lg text-left text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronIcon size={14} className={cn('mr-2 transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
        <TimelineStatusIcon status="running" className="mr-2" />
        <span>{t('chat.process')}</span>
        <span className="ml-2 text-foreground" data-testid="timeline-progress-update">
          {latest}
        </span>
      </button>
      <div id={regionId} hidden={!expanded} className="mt-1 border-l border-border pl-3">
        {items.map((item) => (
          <div key={item.id} className="py-1 text-xs text-muted-foreground">
            <div>{executionTitle(item, t)}</div>
            {item.progress.map((entry) => (
              <div key={entry.id} className="whitespace-pre-wrap text-foreground">{entry.text}</div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function latestProgress(items: TimelineItemView[]): string | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if ('progress' in item && item.progress.length > 0) return item.progress.at(-1)?.text;
  }
  return undefined;
}
