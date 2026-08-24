import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useTransitionState } from '../../hooks/useTransitionState';
import { CloseIcon, CompletedIcon, ErrorIcon, InfoIcon, WarningIcon } from '../../icons';
import { useI18n } from '../../i18n';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPlacement = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';

export interface NotificationProps {
  /** 幂等键：相同 key 再次 open 时更新现有实例而非新开 */
  key?: string;
  title: ReactNode;
  description?: ReactNode;
  type?: NotificationType;
  /** 目标容器位置（默认 topRight；仅经 notification.open* 生效） */
  placement?: NotificationPlacement;
  /** duration<=0 表示常驻（仅手动关闭） */
  duration?: number;
  /** 鼠标悬停暂停自动关闭（duration>0 时生效） */
  pauseOnHover?: boolean;
  onClose?: () => void;
  closable?: boolean;
  icon?: ReactNode;
  className?: string;
  /** Keep true for standalone notifications; containers own one shared live region. */
  announce?: boolean;
}

const typeStyles: Record<NotificationType, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

const typeIcons = {
  info: InfoIcon,
  success: CompletedIcon,
  warning: WarningIcon,
  error: ErrorIcon,
} satisfies Record<NotificationType, typeof InfoIcon>;

export function NotificationItem(props: NotificationProps) {
  const { translate } = useI18n();
  const {
    title,
    description,
    type = 'info',
    duration = 4500,
    onClose,
    closable = true,
    icon,
    className,
    announce = true,
    pauseOnHover = false,
  } = props;
  const [open, setOpen] = useState(true);
  const [hovered, setHovered] = useState(false);
  const { state } = useTransitionState(open, 200);

  useEffect(() => {
    if (state !== 'visible' || duration <= 0) return;
    if (hovered && pauseOnHover) return;
    const timer = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(timer);
  }, [state, duration, hovered, pauseOnHover]);

  useEffect(() => {
    if (state === 'closed') onClose?.();
  }, [state, onClose]);

  if (state === 'closed') return null;

  const anim = state === 'entering' ? 'anim-slide-in-right' : state === 'exiting' ? 'anim-fade-out' : '';

  const handleClose = () => setOpen(false);
  const StatusIcon = typeIcons[type];

  return (
    <div
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
      onMouseEnter={pauseOnHover ? () => setHovered(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setHovered(false) : undefined}
      className={cn(
        'flex gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg w-80',
        anim,
        className,
      )}
    >
      {icon ?? (
        <StatusIcon
          size={20}
          className={typeStyles[type]}
          aria-hidden="true"
          data-status-icon={type}
        />
      )}
      <div className="flex-1">
        <div className={cn('font-medium', description && 'mb-1')}>{title}</div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          aria-label={translate('modal.close')}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
