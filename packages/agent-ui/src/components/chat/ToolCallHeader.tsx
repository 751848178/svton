import { ChevronIcon, cn } from '@svton/ui';
import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';
import type { ToolCallInfo } from './tool-call-card.types';
import type { ToolCallPresentation } from './tool-call-card.utils';

export function ToolCallHeader({
  toolCall, view, expanded, onToggle,
}: {
  toolCall: ToolCallInfo;
  view: ToolCallPresentation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const summary = view.shellCommand || view.fileName || view.argsPreview;
  return (
    <button
      type="button"
      className="group flex min-h-11 w-full items-center gap-1.5 rounded-md text-left"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <TimelineStatusIcon status={toolCall.status} />
      {view.mcpServer && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-status-info">MCP</span>
      )}
      <span className={cn(
        'shrink-0 font-mono text-xs',
        view.isComputerUse || view.mcpServer ? 'text-status-info' : 'text-foreground',
      )}>
        {view.displayName}
      </span>
      {summary && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{summary}</span>}
      <ChevronIcon
        size={14}
        className={cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
        aria-hidden="true"
      />
    </button>
  );
}
