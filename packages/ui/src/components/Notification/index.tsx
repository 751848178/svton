import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';

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
}

const typeStyles: Record<NotificationType, string> = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-orange-500',
  error: 'text-red-500',
};

export function Notification(props: NotificationProps) {
  const { title, description, type = 'info', duration = 4500, onClose, closable = true, icon, className } = props;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const defaultIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={typeStyles[type]}>
      {type === 'success' && <><circle cx="12" cy="12" r="10" /><polyline points="9 12 12 15 16 10" /></>}
      {type === 'error' && <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>}
      {type === 'warning' && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>}
      {type === 'info' && <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>}
    </svg>
  );

  return (
    <div className={cn('flex gap-3 p-4 bg-white rounded-lg shadow-lg w-80', className)}>
      {icon ?? defaultIcon}
      <div className="flex-1">
        <div className={cn('font-medium', description && 'mb-1')}>{title}</div>
        {description && <div className="text-sm text-black/60">{description}</div>}
      </div>
      {closable && (
        <button onClick={handleClose} className="text-black/45 hover:text-black/70">×</button>
      )}
    </div>
  );
}

interface NotificationItem extends NotificationProps {
  id: string;
}

let setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>> | null = null;

export function NotificationContainer({ placement = 'topRight' }: { placement?: Placement }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  setNotifications = setItems;

  return (
    <Portal>
      <div
        className={cn(
          'fixed z-[2000] flex flex-col gap-3',
          placement.includes('top') ? 'top-6' : 'bottom-6',
          placement.includes('Right') ? 'right-6' : 'left-6'
        )}
      >
        {items.map((item) => (
          <Notification key={item.id} {...item} onClose={() => setItems((prev) => prev.filter((n) => n.id !== item.id))} />
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
