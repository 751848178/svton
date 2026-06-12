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
  /** Start collapsed (for completed turns) */
  defaultCollapsed?: boolean;
  className?: string;
}

/** Tools that run shell commands */
const SHELL_TOOLS = new Set(['bash', 'shell', 'exec', 'run_command', 'terminal']);

/** Tools that edit files */
const FILE_EDIT_TOOLS = new Set(['file_edit', 'edit', 'write_file', 'create_file', 'apply_diff']);

/** Max lines of output to show when expanded (head + tail budget) */
const OUTPUT_MAX_LINES = 20;

/** Status → icon */
const STATUS_ICON: Record<ToolCallInfo['status'], { char: string; color: string }> = {
  running: { char: '●', color: 'text-blue-400 animate-pulse' },
  completed: { char: '✓', color: 'text-green-400' },
  error: { char: '✗', color: 'text-red-500' },
  pending_approval: { char: '⚠', color: 'text-yellow-500' },
};

/**
 * Truncate output lines showing head + tail with ellipsis in between.
 * Codex pattern: see the beginning and end of output.
 */
function truncateOutput(output: string, maxLines: number): { text: string; truncated: number } {
  const lines = output.split('\n');
  if (lines.length <= maxLines) return { text: output, truncated: 0 };

  const headCount = Math.ceil(maxLines / 2);
  const tailCount = Math.floor(maxLines / 2);
  const head = lines.slice(0, headCount);
  const tail = lines.slice(-tailCount);
  const truncated = lines.length - headCount - tailCount;

  return {
    text: [...head, `  ... +${truncated} lines`, ...tail].join('\n'),
    truncated,
  };
}

/**
 * Codex-style tool call card.
 * - Shell commands: inline command with dimmed output
 * - File edits: compact card with diff preview
 * - Generic tools: standard parameter + output view
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolCall,
  onApprove,
  onReject,
  defaultCollapsed,
  className,
}) => {
  const isDone = toolCall.status === 'completed' || toolCall.status === 'error';
  const [expanded, setExpanded] = useState(() => defaultCollapsed ? false : !isDone);

  const icon = STATUS_ICON[toolCall.status];
  const isShell = SHELL_TOOLS.has(toolCall.name);
  const isFileEdit = FILE_EDIT_TOOLS.has(toolCall.name);
  const displayName = getToolDisplayName(toolCall.name);

  // For shell tools, extract the command for inline display
  const shellCommand = isShell ? (toolCall.arguments.command as string || '') : '';
  const fileName = isFileEdit ? (toolCall.arguments.path as string || toolCall.arguments.file_path as string || '') : '';

  // Build args preview (non-shell, non-file-edit tools)
  const argsPreview = !isShell && !isFileEdit
    ? Object.entries(toolCall.arguments)
        .map(([k, v]) => {
          const val = typeof v === 'string' ? v : JSON.stringify(v);
          return `${k}: ${val.length > 30 ? val.slice(0, 30) + '…' : val}`;
        })
        .join(', ')
    : '';

  const output = toolCall.result?.output ?? '';
  const isMarkdownOutput = output && (
    output.includes('##') ||
    output.includes('```') ||
    output.includes('- ') ||
    output.includes('1. ')
  );
  const isDiffOutput = isDiff(output);

  return (
    <div className={cn('text-sm', className)}>
      {/* Header row — always visible */}
      <button
        className="w-full flex items-start gap-1.5 text-left group"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('flex-shrink-0 mt-px text-xs', icon.color)}>{icon.char}</span>
        {isShell ? (
          /* Shell: show command inline */
          <span className="font-mono text-xs text-gray-400 truncate flex-1">
            <span className="text-cyan-600">{displayName}</span>
            <span className="text-gray-600 mx-1">→</span>
            <span className="text-gray-300">{shellCommand.length > 80 ? shellCommand.slice(0, 80) + '…' : shellCommand}</span>
          </span>
        ) : isFileEdit ? (
          /* File edit: show file path */
          <span className="text-xs text-gray-400 truncate flex-1">
            <span className="text-cyan-600">{displayName}</span>
            <span className="text-gray-600 mx-1">→</span>
            <span className="text-gray-300">{fileName}</span>
          </span>
        ) : (
          /* Generic tool */
          <>
            <span className="font-mono text-xs text-cyan-600 flex-shrink-0">{displayName}</span>
            <span className="text-xs text-gray-400 truncate flex-1">{argsPreview}</span>
          </>
        )}
        <span className="text-gray-500 text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Collapsed preview — compact one-liner for completed tools */}
      {!expanded && toolCall.result && !toolCall.result.isError && output && !isFileEdit && (
        <div className="mt-0.5 pl-4">
          <span className="text-xs text-gray-600 line-clamp-1">
            {output.slice(0, 120)}
            {output.length > 120 && '…'}
          </span>
        </div>
      )}

      {/* Error preview when collapsed */}
      {!expanded && toolCall.result?.isError && (
        <div className="mt-0.5 pl-4">
          <span className="text-xs text-red-400/80 line-clamp-1">
            {output.slice(0, 120)}
            {output.length > 120 && '…'}
          </span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-1.5">
          {/* Shell command — show full command */}
          {isShell && shellCommand && (
            <div className="text-xs">
              <div className="bg-[#1a1a1a] rounded-md px-3 py-1.5 font-mono text-gray-300 border border-[#252525] overflow-x-auto">
                <span className="text-gray-500 select-none">$ </span>
                {shellCommand}
              </div>
            </div>
          )}

          {/* File edit — show path */}
          {isFileEdit && fileName && (
            <div className="text-xs text-gray-400">
              <span className="text-gray-500 select-none">File: </span>
              <span className="text-gray-300 font-mono">{fileName}</span>
            </div>
          )}

          {/* Generic tool parameters (non-shell, non-file-edit) */}
          {!isShell && !isFileEdit && (
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">{t('tool.parameters')}</div>
              <pre className="text-xs text-gray-400 bg-[#1a1a1a] rounded-md px-3 py-1.5 overflow-x-auto overflow-y-auto max-h-60 border border-[#252525]">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* Result output */}
          {toolCall.result && output && (
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">
                {toolCall.result.isError ? t('tool.error') : t('tool.output')}
              </div>
              {isDiffOutput ? (
                <DiffView diff={output} className="flex-1 min-w-0" />
              ) : isMarkdownOutput && !toolCall.result.isError ? (
                <div className={cn(
                  'rounded-md px-3 py-1.5 overflow-x-auto overflow-y-auto max-h-80 text-xs',
                  toolCall.result.isError ? 'bg-red-950/50 text-red-400' : 'bg-[#1a1a1a] text-gray-400',
                )}>
                  <MarkdownRenderer content={output} className="text-xs" />
                </div>
              ) : (
                <ShellOutput output={output} isError={toolCall.result.isError} maxLines={OUTPUT_MAX_LINES} />
              )}
            </div>
          )}

          {/* Pending approval indicator */}
          {toolCall.status === 'pending_approval' && (
            <div className="text-xs text-yellow-600">{t('tool.pending')}</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ShellOutput — dimmed output with head+tail truncation ─────

function ShellOutput({ output, isError, maxLines }: { output: string; isError?: boolean; maxLines: number }) {
  const { text, truncated } = truncateOutput(output, maxLines);

  return (
    <pre
      className={cn(
        'text-xs rounded-md px-3 py-1.5 overflow-x-auto max-h-80 overflow-y-auto border',
        isError
          ? 'bg-red-950/30 text-red-400/90 border-red-900/30'
          : 'bg-[#1a1a1a] text-gray-500 border-[#252525]',
      )}
    >
      {text}
    </pre>
  );
}
