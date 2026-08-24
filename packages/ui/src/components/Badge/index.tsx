import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeStatus = 'default' | 'processing' | 'success' | 'warning' | 'error';

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  max?: number;
  showZero?: boolean;
  /** 自定义颜色（默认走 status-error token，随主题切换） */
  color?: string;
  /** 状态点模式：语义色圆点 + 说明文字（children 为文字） */
  status?: BadgeStatus;
  offset?: [number, number];
  children?: ReactNode;
  className?: string;
}

const statusColors: Record<BadgeStatus, string> = {
  default: 'var(--svton-ui-foreground)',
  processing: 'var(--svton-ui-status-info)',
  success: 'var(--svton-ui-status-success)',
  warning: 'var(--svton-ui-status-warning)',
  error: 'var(--svton-ui-status-error)',
};

const statusText: Record<BadgeStatus, string> = {
  default: '',
  processing: 'animate-pulse',
  success: '',
  warning: '',
  error: '',
};

export function Badge(props: BadgeProps) {
  const {
    count = 0,
    dot = false,
    max = 99,
    showZero = false,
    color,
    status,
    offset = [0, 0],
    children,
    className,
  } = props;

  if (status !== undefined) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', statusText[status])}
          style={{ backgroundColor: color ?? statusColors[status] }}
        />
        {children ? <span className="text-sm text-muted-foreground">{children}</span> : null}
      </span>
    );
  }

  const resolvedColor = color ?? statusColors.error;
  const showBadge = dot || count > 0 || (count === 0 && showZero);
  const displayCount = count > max ? `${max}+` : count;

  const badgeContent = (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        dot ? 'size-2' : 'min-w-[18px] h-[18px] px-1.5 text-xs font-medium text-status-on-color',
      )}
      style={{ backgroundColor: resolvedColor }}
    >
      {!dot && displayCount}
    </span>
  );

  if (!children) return badgeContent;

  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {showBadge && (
        <span
          className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
          style={{ marginTop: offset[1], marginRight: -offset[0] }}
        >
          {badgeContent}
        </span>
      )}
    </span>
  );
}
