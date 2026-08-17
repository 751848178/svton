import React from 'react';
import { CommandExecutionItemView } from './CommandExecutionItemView';
import { OutcomeItemView } from './OutcomeItemView';
import { ProcessDisclosure } from './ProcessDisclosure';
import { ToolExecutionItemView } from './ToolExecutionItemView';
import { ApprovalDecisionItemView } from './ApprovalDecisionItemView';
import { FileOutcomeItemView } from './FileOutcomeItemView';
import type {
  CommandExecutionItemView as CommandItem,
  TimelineHostCapabilities,
  TimelineHostIntentHandler,
  TimelineItemView,
  TimelineTurnView,
  ToolExecutionItemView as ToolItem,
} from './timeline.types';

const TERMINAL = new Set(['completed', 'failed', 'declined', 'cancelled', 'interrupted']);

export function TimelineSection({
  timeline,
  capabilities,
  onIntent,
}: {
  timeline?: TimelineTurnView;
  capabilities: TimelineHostCapabilities;
  onIntent?: TimelineHostIntentHandler;
}) {
  if (!timeline || timeline.items.length === 0) return null;
  const process = timeline.items.filter(isRunningExecution);
  const approvals = timeline.items.filter((item) => item.kind === 'approvalDecision');
  const files = timeline.items.filter((item) => item.kind === 'fileOutcome');
  const fileSourceIds = new Set(files.flatMap((item) => item.sourceCallIds));
  const terminal = timeline.items.filter((item) =>
    item.kind !== 'approvalDecision'
    && item.kind !== 'fileOutcome'
    && !fileSourceIds.has(item.id)
    && TERMINAL.has(item.status));
  return (
    <section data-testid="timeline-section" data-turn-status={timeline.status}>
      <ProcessDisclosure items={process} />
      {approvals.map((item) => <ApprovalDecisionItemView key={item.id} item={item} />)}
      {files.map((item) => (
        <FileOutcomeItemView
          key={item.id}
          item={item}
          capabilities={capabilities}
          onIntent={onIntent}
        />
      ))}
      {terminal.map((item) => renderTerminal(item, capabilities, onIntent))}
    </section>
  );
}

function isRunningExecution(item: TimelineItemView): item is ToolItem | CommandItem {
  return (item.kind === 'toolExecution' || item.kind === 'commandExecution')
    && !TERMINAL.has(item.status);
}

function renderTerminal(
  item: TimelineItemView,
  capabilities: TimelineHostCapabilities,
  onIntent?: TimelineHostIntentHandler,
) {
  if (item.kind === 'commandExecution') {
    return <CommandExecutionItemView key={item.id} item={item} capabilities={capabilities} onIntent={onIntent} />;
  }
  if (item.kind === 'toolExecution') {
    return <ToolExecutionItemView key={item.id} item={item} onIntent={onIntent} />;
  }
  if (item.kind === 'approvalDecision') return null;
  if (item.kind === 'fileOutcome') return null;
  return <OutcomeItemView key={item.id} item={item} onIntent={onIntent} />;
}
