import React, { useState } from 'react';
import { cn, t } from '@svton/ui';
import { DiffView, isDiff } from './DiffView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getToolDisplayName } from './tool-names';

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: {
    output: string;
    isError?: boolean;
    metadata?: Record<string, unknown>;
  };
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}

export interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  className?: string;
}

/** Max lines of output to show when collapsed */
const OUTPUT_PREVIEW_LINES = 8;

/** Status → icon */
const STATUS_ICON: Record<ToolCallInfo['status'], { char: string; color: string }> = {
  running: { char: '●', color: 'text-blue-400 animate-pulse' },
  completed: { char: '✓', color: 'text-green-400' },
  error: { char: '✗', color: 'text-red-500' },
  pending_approval: { char: '⚠', color: 'text-yellow-500' },
};

/**
 * Codex-style tool call card with improved readability.
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolCall,
  onApprove,
  onReject,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);

  const icon = STATUS_ICON[toolCall.status];
  const isRunning = toolCall.status === 'running';
  const displayName = getToolDisplayName(toolCall.name);

  // Build a one-line argument preview
  const argsPreview = Object.entries(toolCall.arguments)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${val.length > 30 ? val.slice(0, 30) + '…' : val}`;
    })
    .join(', ');

  const outputLines = toolCall.result?.output?.split('\n') ?? [];
  const hasMoreLines = outputLines.length > OUTPUT_PREVIEW_LINES;

  // Check if output looks like markdown (headers, lists, code blocks)
  const isMarkdown = toolCall.result?.output && (
    toolCall.result.output.includes('##') ||
    toolCall.result.output.includes('```') ||
    toolCall.result.output.includes('- ') ||
    toolCall.result.output.includes('1. ')
  );

  return (
    <div className={cn('text-sm', className)}>
      {/* Header row — always visible */}
      <button
        className="w-full flex items-start gap-1.5 text-left group"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-300 select-none flex-shrink-0">│</span>
        <span className={cn('flex-shrink-0 mt-px text-xs', icon.color)}>{icon.char}</span>
        <span className="font-mono text-xs text-cyan-600 flex-shrink-0">{displayName}</span>
        <span className="text-xs text-gray-400 truncate flex-1">{argsPreview}</span>
        <span className="text-gray-300 text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Collapsed preview — show when NOT expanded */}
      {!expanded && toolCall.result && !toolCall.result.isError && (
        <div className="ml-5 mt-0.5">
          <span className="text-gray-300 text-xs select-none">└ </span>
          <span className="text-xs text-gray-500 line-clamp-2">
            {toolCall.result.output?.slice(0, 120)}
            {(toolCall.result.output?.length ?? 0) > 120 && '…'}
          </span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-2">
          {/* Arguments */}
          <div className="flex items-start gap-1.5">
            <span className="text-gray-300 select-none flex-shrink-0 text-xs">├</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-400 font-medium mb-0.5">{t('tool.parameters')}</div>
              <pre className="text-xs text-gray-400 bg-[#1c1c1c] rounded-lg px-3 py-2 overflow-x-auto border border-[#2a2a2a]">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          </div>

          {/* Result output */}
          {toolCall.result && (
            <div className="flex items-start gap-1.5">
              <span className="text-gray-300 select-none flex-shrink-0 text-xs">└</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-400 font-medium mb-0.5">
                  {toolCall.result.isError ? t('tool.error') : t('tool.output')}
                </div>
                {isDiff(toolCall.result.output) ? (
                  <DiffView diff={toolCall.result.output} className="flex-1 min-w-0" />
                ) : isMarkdown && !toolCall.result.isError ? (
                  <div className={cn(
                    'rounded-lg px-3 py-2 overflow-x-auto',
                    toolCall.result.isError ? 'bg-red-950' : 'bg-[#1c1c1c]',
                  )}>
                    <MarkdownRenderer content={toolCall.result.output} className="text-xs" />
                  </div>
                ) : (
                  <pre
                    className={cn(
                      'text-xs rounded-lg px-3 py-2 overflow-x-auto max-h-64 overflow-y-auto',
                      toolCall.result.isError ? 'bg-red-950 text-red-400' : 'bg-[#1c1c1c] text-gray-400',
                    )}
                  >
                    {toolCall.result.output}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Pending approval indicator — modal handles the actual approval */}
          {toolCall.status === 'pending_approval' && (
            <div className="ml-5 mt-0.5">
              <span className="text-gray-300 text-xs select-none">└ </span>
              <span className="text-xs text-yellow-600">{t('tool.pending')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
