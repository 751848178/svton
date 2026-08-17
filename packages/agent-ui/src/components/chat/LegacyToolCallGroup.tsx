import { useState } from 'react';
import { ChevronIcon, cn, useI18n } from '@svton/ui';
import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';
import { ToolCallCard } from './ToolCallCard';
import type { ToolCallInfo } from './tool-call-card.types';

const EXPLORING_TOOLS = new Set([
  'file_read', 'read', 'grep', 'search', 'glob', 'list_files', 'web_search', 'web_fetch',
]);

export function LegacyToolCallGroup({
  toolCalls, onApprove, onReject, defaultCollapsed,
}: {
  toolCalls: ToolCallInfo[];
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  defaultCollapsed?: boolean;
}) {
  return <>{groupCalls(toolCalls).map((group, index) => group.kind === 'single'
    ? <ToolCallCard key={group.call.id} toolCall={group.call} onApprove={onApprove} onReject={onReject} defaultCollapsed={defaultCollapsed} />
    : <ExploringGroup key={`exploring-${index}`} calls={group.calls} onApprove={onApprove} onReject={onReject} defaultCollapsed={defaultCollapsed} />)}</>;
}

type CallGroup = { kind: 'single'; call: ToolCallInfo } | { kind: 'exploring'; calls: ToolCallInfo[] };

function groupCalls(calls: ToolCallInfo[]): CallGroup[] {
  const groups: CallGroup[] = [];
  for (let index = 0; index < calls.length;) {
    if (!isExplorable(calls[index])) { groups.push({ kind: 'single', call: calls[index++] }); continue; }
    const batch: ToolCallInfo[] = [];
    while (index < calls.length && isExplorable(calls[index])) batch.push(calls[index++]);
    groups.push({ kind: 'exploring', calls: batch });
  }
  return groups;
}

function isExplorable(call: ToolCallInfo): boolean {
  return EXPLORING_TOOLS.has(call.name) && call.status === 'completed' && !call.result?.isError;
}

function ExploringGroup({
  calls, onApprove, onReject, defaultCollapsed,
}: {
  calls: ToolCallInfo[];
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  defaultCollapsed?: boolean;
}) {
  const { translate: t } = useI18n();
  const active = calls.some((call) => call.status === 'running');
  const [expanded, setExpanded] = useState(() => defaultCollapsed ? false : !active);
  return (
    <div className="text-sm">
      <button type="button" className="group flex min-h-11 w-full items-center gap-1.5 rounded-md text-left" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        <TimelineStatusIcon status={active ? 'running' : 'completed'} />
        <span className="text-xs font-semibold text-foreground">{active ? t('tool.exploring') : t('tool.explored')}</span>
        <span className="text-xs text-muted-foreground">({calls.length} {calls.length === 1 ? t('tool.call') : t('tool.calls')})</span>
        <ChevronIcon size={14} className={cn('ml-auto text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      </button>
      {!expanded && <p className="ml-5 mt-0.5 truncate text-xs text-muted-foreground">{calls.map(argumentPreview).filter(Boolean).join(', ')}</p>}
      {expanded && calls.map((call) => <ToolCallCard key={call.id} toolCall={call} onApprove={onApprove} onReject={onReject} />)}
    </div>
  );
}

function argumentPreview(call: ToolCallInfo): string {
  const text = Object.values(call.arguments).map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ');
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
