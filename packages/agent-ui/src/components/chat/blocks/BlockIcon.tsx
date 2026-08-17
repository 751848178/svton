import React from 'react';
import type { ElementType } from 'react';
import {
  CompletedIcon,
  ErrorIcon,
  FileIcon,
  PendingIcon,
  PlanIcon,
  RunningIcon,
  SubagentIcon,
  WarningIcon,
  cn,
  type SvtonIconProps,
} from '@svton/ui';

export type BlockType = 'plan' | 'file' | 'subagent' | 'warning';
export type BlockStatus = 'running' | 'completed' | 'error' | 'pending';
type IconView = { Icon: ElementType<SvtonIconProps>; className: string };

const STATUS_ICON: Record<BlockStatus, IconView> = {
  running: { Icon: RunningIcon, className: 'animate-spin text-status-info motion-reduce:animate-none' },
  completed: { Icon: CompletedIcon, className: 'text-status-success' },
  error: { Icon: ErrorIcon, className: 'text-destructive' },
  pending: { Icon: PendingIcon, className: 'text-muted-foreground' },
};
const TYPE_ICON: Record<BlockType, ElementType<SvtonIconProps>> = {
  plan: PlanIcon,
  file: FileIcon,
  subagent: SubagentIcon,
  warning: WarningIcon,
};

interface BlockIconProps {
  type: BlockType;
  status?: BlockStatus;
  className?: string;
}

/** Decorative line icon paired with the block's visible type or status label. */
export const BlockIcon: React.FC<BlockIconProps> = ({ type, status, className }) => {
  const view = status ? STATUS_ICON[status] : { Icon: TYPE_ICON[type], className: '' };
  const Icon = view.Icon;
  return <Icon size={14} className={cn('flex-shrink-0', view.className, className)} aria-hidden="true" />;
};
