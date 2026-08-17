import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { useTransitionState } from '../../hooks/useTransitionState';
import { CloseIcon, CompletedIcon, ErrorIcon, InfoIcon, WarningIcon } from '../../icons';
import { useI18n } from '../../i18n';

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type Placement = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';

export interface NotificationProps {
  title: ReactNode;
  description?: ReactNode;
  type?: NotificationType;
  duration?: number;
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

function NotificationItemInternal(props: NotificationProps) {
  const { translate } = useI18n();
  const { title, description, type = 'info', duration = 4500, onClose, closable = true, icon, className, announce = true } = props;
  const [open, setOpen] = useState(true);
  const { state } = useTransitionState(open, 200);

  // Auto-close after duration (starts counting after enter animation)
  useEffect(() => {
    if (state !== 'visible' || duration <= 0) return;
    const timer = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(timer);
  }, [state, duration]);

  // Notify parent when exit animation finishes
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
      className={cn('flex gap-3 p-4 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg w-80', anim, className)}
    >
      {icon ?? <StatusIcon size={20} className={typeStyles[type]} aria-hidden="true" data-status-icon={type} />}
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

interface NotificationData extends NotificationProps {
  id: string;
}

let setNotifications: React.Dispatch<React.SetStateAction<NotificationData[]>> | null = null;

export function NotificationContainer({ placement = 'topRight' }: { placement?: Placement }) {
  const [items, setItems] = useState<NotificationData[]>([]);
  setNotifications = setItems;

  return (
    <Portal>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className={cn(
          'fixed z-[2000] flex flex-col gap-3',
          placement.includes('top') ? 'top-6' : 'bottom-6',
          placement.includes('Right') ? 'right-6' : 'left-6'
        )}
      >
        {items.map((item) => (
          <NotificationItemInternal key={item.id} {...item} announce={false} onClose={() => setItems((prev) => prev.filter((n) => n.id !== item.id))} />
        ))}
      </div>
    </Portal>
  );
}

export const notification = {
  open: (config: NotificationProps) => {
    const id = Math.random().toString(36).slice(2);
    if (setNotifications) {
      setNotifications((prev) => [...prev, { ...config, id }]);
    }
  },
  info: (config: Omit<NotificationProps, 'type'>) => notification.open({ ...config, type: 'info' }),
  success: (config: Omit<NotificationProps, 'type'>) => notification.open({ ...config, type: 'success' }),
  warning: (config: Omit<NotificationProps, 'type'>) => notification.open({ ...config, type: 'warning' }),
  error: (config: Omit<NotificationProps, 'type'>) => notification.open({ ...config, type: 'error' }),
};

/** @deprecated Use notification.open() or NotificationContainer instead. This component is for internal use. */
export const Notification = NotificationItemInternal;
