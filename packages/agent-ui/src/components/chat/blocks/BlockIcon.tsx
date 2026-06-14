import React from 'react';
import { cn } from '@svton/ui';

export type BlockType = 'plan' | 'file' | 'subagent' | 'warning';

export type BlockStatus = 'running' | 'completed' | 'error' | 'pending';

/** Shared status → { char, color } lookup, mirrors ToolCallCard STATUS_ICON */
const STATUS_STYLE: Record<BlockStatus, { char: string; color: string }> = {
  running: { char: '●', color: 'text-blue-400 animate-pulse' },
  completed: { char: '✓', color: 'text-green-400' },
  error: { char: '✗', color: 'text-red-500' },
  pending: { char: '○', color: 'text-gray-500' },
};

/** Block type → base icon char */
const TYPE_ICON: Record<BlockType, string> = {
  plan: '📋',
  file: '📄',
  subagent: '🤖',
  warning: '⚠',
};

interface BlockIconProps {
  type: BlockType;
  status?: BlockStatus;
  className?: string;
}

/**
 * Atomic block header icon — shows type emoji + status indicator.
 */
export const BlockIcon: React.FC<BlockIconProps> = ({ type, status, className }) => {
  if (status) {
    const s = STATUS_STYLE[status];
    return (
      <span className={cn('flex-shrink-0 text-xs', s.color, className)}>
        {s.char}
      </span>
    );
  }
  return (
    <span className={cn('flex-shrink-0 text-xs', className)}>
      {TYPE_ICON[type]}
    </span>
  );
};
